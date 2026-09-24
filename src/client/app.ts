// NippleJS is loaded globally via CDN
declare const nipplejs: any;

let ws: WebSocket | null = null;
let currentSlot: number = -1;
let outX: number = 0;
let outY: number = 0;
let lastSentX: number = -1;
let lastSentY: number = -1;
let isLooping: boolean = false;
let joystick: any = null;
let playerName: string = "Anonymous";
let isRejected: boolean = false;

const gate = document.getElementById('gate') as HTMLDivElement;
const ui = document.getElementById('ui') as HTMLDivElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const exitBtn = document.getElementById('exit-btn') as HTMLButtonElement;
const slotIndicator = document.getElementById('slot-indicator') as HTMLSpanElement;
const joystickZone = document.getElementById('joystick-zone') as HTMLDivElement;
const dynamicControls = document.getElementById('dynamic-controls') as HTMLDivElement;
const nameInput = document.getElementById('player-name') as HTMLInputElement;
const roomInput = document.getElementById('room-code-input') as HTMLInputElement;
const errorMsg = document.getElementById('error-msg') as HTMLParagraphElement;

// Auto-fill room code from URL if present
const urlParams = new URLSearchParams(window.location.search);
const currentRoomCode = urlParams.get('room') || "";
if (currentRoomCode && roomInput) {
    roomInput.value = currentRoomCode;
}

// --- 1. Joining and Exiting (State Machine) ---
joinBtn.addEventListener('click', () => {
    const rawName = nameInput.value.trim();
    if (rawName !== "") playerName = rawName.substring(0, 12); 

    errorMsg.innerText = ""; // Clear errors
    isRejected = false;

    if ('wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').catch(console.error);
    }
    
    gate.style.display = 'none';
    ui.style.display = 'flex';
    initJoystick();
    connectWS();
});

exitBtn.addEventListener('click', () => {
    if (ws) ws.close(); 
    ui.style.display = 'none';
    gate.style.display = 'flex';
    if (joystick) {
        joystick.destroy();
        joystick = null;
    }
    currentSlot = -1;
    outX = 0; outY = 0;
    if (dynamicControls) dynamicControls.innerHTML = "";
});

// --- 2. Dynamic UI Generation ---
function buildDynamicUI(blueprint: any[]) {
    if (!dynamicControls) return;
    dynamicControls.innerHTML = "";
    
    blueprint.forEach(control => {
        const wrapper = document.createElement('div');
        wrapper.className = 'dynamic-control-wrapper';
        
        if (control.type === 'button') {
            const btn = document.createElement('button');
            btn.className = 'action-btn mat-elevation-z1';
            btn.style.backgroundColor = control.color;
            btn.innerHTML = `<span class="btn-title">${control.label}</span>`;
            
            const sendState = (state: number) => {
                if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
                    ws.send(JSON.stringify({ type: 'control', id: control.id, value: state }));
                }
            };
            
            const triggerPress = (e: Event) => { e.preventDefault(); btn.classList.add('is-active'); sendState(1); };
            const triggerRelease = (e: Event) => { e.preventDefault(); btn.classList.remove('is-active'); sendState(0); };
            
            btn.addEventListener('mousedown', triggerPress);
            btn.addEventListener('touchstart', triggerPress, { passive: false });
            
            // Hardened release triggers
            btn.addEventListener('mouseup', triggerRelease);
            btn.addEventListener('mouseleave', triggerRelease);
            btn.addEventListener('touchend', triggerRelease);
            btn.addEventListener('touchcancel', triggerRelease);
            
            wrapper.appendChild(btn);
        } else if (control.type === 'slider') {
            const label = document.createElement('label');
            label.innerText = control.label;
            label.style.color = '#fff';
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = control.min.toString();
            slider.max = control.max.toString();
            slider.step = control.step.toString();
            slider.value = control.default_val.toString();
            slider.style.width = '100%';
            
            slider.addEventListener('input', (e: any) => {
                if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
                    ws.send(JSON.stringify({ type: 'control', id: control.id, value: parseFloat(e.target.value) }));
                }
            });
            
            wrapper.appendChild(label);
            wrapper.appendChild(slider);
        }
        
        dynamicControls.appendChild(wrapper);
    });
}

// --- 3. Joystick & Resize Logic ---
function initJoystick() {
    if (joystick) joystick.destroy();

    const joySize = Math.min(window.innerWidth / 2.5, 250);
    joystick = nipplejs.create({
        zone: joystickZone,
        mode: 'dynamic',
        color: '#1a73e8', // Google Blue to match Material UI
        size: joySize
    });

    joystick.on('move', (evt: any, data: any) => {
        if (!data || !data.angle) return;
        const radius = data.instance.options.size / 2;
        outX = data.distance * Math.cos(data.angle.radian) / radius;
        outY = -(data.distance * Math.sin(data.angle.radian) / radius); 
    });

    joystick.on('end', () => {
        outX = 0;
        outY = 0;
    });
}

window.addEventListener('resize', () => {
    if (ui.style.display === 'flex') {
        initJoystick();
    }
});

// --- 4. WebSocket ---
function connectWS() {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
    
    const host = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `wss://bat-lives-progressive-easy.trycloudflare.com`;
    
    ws = new WebSocket(host);

    ws.onopen = () => {
        slotIndicator.innerText = "Connected! Waiting for slot...";
        const finalRoomCode = roomInput.value.trim().toUpperCase();
        ws?.send(JSON.stringify({ type: 'join', name: playerName, room: finalRoomCode }));

        if (!isLooping) {
            isLooping = true;
            requestAnimationFrame(networkLoop); 
        }
    };

    ws.onmessage = (msg: MessageEvent) => {
        try {
            const data = JSON.parse(msg.data);
            if (data.type === 'assigned_slot') {
                currentSlot = data.slot;
                slotIndicator.innerText = `${playerName} (Player ${currentSlot})`;
                slotIndicator.style.color = '#34a853'; // Google Green
                
                if (data.ui_blueprint) {
                    buildDynamicUI(data.ui_blueprint);
                }
            }
            if (data.type === 'rejected') {
                isRejected = true;
                errorMsg.innerText = data.reason || "Installation Full!";
                exitBtn.click(); // Return to gate UI
            }
        } catch (e) {}
    };

    ws.onclose = () => {
        if (ui.style.display === 'flex' && !isRejected) {
            slotIndicator.innerText = "Disconnected. Reconnecting...";
            slotIndicator.style.color = '#ea4335';
            currentSlot = -1;
            setTimeout(connectWS, 2000); 
        }
    };
}

// --- 5. Network Loop ---
let lastFrameTime = 0;
function networkLoop(timestamp: number) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (timestamp - lastFrameTime > 33) {
        if (currentSlot !== -1) {
            if (outX !== lastSentX || outY !== lastSentY) {
                ws.send(JSON.stringify({ type: 'input', x: outX, y: outY }));
                lastSentX = outX;
                lastSentY = outY;
            }
        }
        lastFrameTime = timestamp;
    }
    requestAnimationFrame(networkLoop);
}

setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
}, 5000);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ui.style.display === 'flex') {
        if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
    }
});
