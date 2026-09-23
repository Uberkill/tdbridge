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

const gate = document.getElementById('gate') as HTMLDivElement;
const ui = document.getElementById('ui') as HTMLDivElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const exitBtn = document.getElementById('exit-btn') as HTMLButtonElement;
const slotIndicator = document.getElementById('slot-indicator') as HTMLSpanElement;
const joystickZone = document.getElementById('joystick-zone') as HTMLDivElement;
const actionBtns = document.querySelectorAll('.action-btn');
const nameInput = document.getElementById('player-name') as HTMLInputElement;

// --- 1. Joining and Exiting (State Machine) ---
joinBtn.addEventListener('click', () => {
    const rawName = nameInput.value.trim();
    if (rawName !== "") playerName = rawName.substring(0, 12); // Max 12 chars

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
});

// --- 2. Action Buttons (UI Feedback & Event Sending) ---
actionBtns.forEach(btn => {
    const actionName = btn.getAttribute('data-action');
    
    const triggerPress = (e: Event) => {
        e.preventDefault(); 
        btn.classList.add('is-active');
        if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
            ws.send(JSON.stringify({ type: 'button', name: actionName, state: 1 }));
        }
    };

    const triggerRelease = (e: Event) => {
        e.preventDefault();
        btn.classList.remove('is-active');
        if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
            ws.send(JSON.stringify({ type: 'button', name: actionName, state: 0 }));
        }
    };

    btn.addEventListener('mousedown', triggerPress);
    btn.addEventListener('touchstart', triggerPress, { passive: false });
    
    btn.addEventListener('mouseup', triggerRelease);
    btn.addEventListener('mouseleave', triggerRelease); 
    btn.addEventListener('touchend', triggerRelease);
    btn.addEventListener('touchcancel', triggerRelease);
});

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

const urlParams = new URLSearchParams(window.location.search);
const currentRoomCode = urlParams.get('room') || "";

// --- 4. WebSocket ---
function connectWS() {
    const hostname = window.location.hostname;
    // If testing locally or on LAN (192.168.x.x), use ws:// on port 8080
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
    
    // Auto-injected Cloudflare Tunnel for public internet access!
    const host = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `wss://watt-begins-prospect-exchange.trycloudflare.com`;
    
    ws = new WebSocket(host);

    ws.onopen = () => {
        slotIndicator.innerText = "Connected! Waiting for slot...";
        // Instantly transmit name and room code upon successful connection
        ws?.send(JSON.stringify({ type: 'join', name: playerName, room: currentRoomCode }));

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
            }
            if (data.type === 'rejected') {
                slotIndicator.innerText = data.reason || `Installation Full!`;
                slotIndicator.style.color = '#ea4335'; // Google Red
            }
        } catch (e) {}
    };

    ws.onclose = () => {
        if (ui.style.display === 'flex') {
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
