let ws = null;
let currentSlot = -1;
let outX = 0;
let outY = 0;
let lastSentX = -1;
let lastSentY = -1;
let isLooping = false;
let joystick = null;
let playerName = "Anonymous";
let isRejected = false;
let reconnectTimer = null;
const gate = document.getElementById('gate');
const ui = document.getElementById('ui');
const joinBtn = document.getElementById('join-btn');
const exitBtn = document.getElementById('exit-btn');
const slotIndicator = document.getElementById('slot-indicator');
const joystickZone = document.getElementById('joystick-zone');
const dynamicControls = document.getElementById('dynamic-controls');
const nameInput = document.getElementById('player-name');
const roomInput = document.getElementById('room-code-input');
const errorMsg = document.getElementById('error-msg');
// Auto-fill room code from URL if present
const urlParams = new URLSearchParams(window.location.search);
const currentRoomCode = urlParams.get('room') || "";
if (currentRoomCode && roomInput) {
    roomInput.value = currentRoomCode;
}
// Fetch Dynamic Branding on Page Load
const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
const wsUrlBase = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `wss://grades-louis-associate-outlet.trycloudflare.com`;
const httpUrlBase = wsUrlBase.replace('ws://', 'http://').replace('wss://', 'https://');
fetch(`${httpUrlBase}/branding`)
    .then(res => res.json())
    .then(b => {
    if (b.project_name)
        document.querySelector('h1').innerText = b.project_name;
    if (b.subtitle)
        document.querySelector('#gate p').innerText = b.subtitle;
    if (b.primary_color)
        joinBtn.style.backgroundColor = b.primary_color;
    if (b.bg_color)
        document.body.style.backgroundColor = b.bg_color;
})
    .catch(e => console.log("Branding fetch failed or offline"));
// --- 1. Joining and Exiting (State Machine) ---
joinBtn.addEventListener('click', () => {
    let rawName = nameInput.value.trim();
    if (rawName === "") {
        // Frictionless Join: Auto-generate a name
        rawName = "Player_" + Math.floor(Math.random() * 9000 + 1000);
    }
    playerName = rawName.substring(0, 12);
    errorMsg.innerText = ""; // Clear errors
    isRejected = false;
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(console.error);
    }
    gate.style.display = 'none';
    ui.style.display = 'flex';
    initJoystick();
    connectWS();
});
exitBtn.addEventListener('click', () => {
    if (ws)
        ws.close();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    ui.style.display = 'none';
    gate.style.display = 'flex';
    if (joystick) {
        joystick.destroy();
        joystick = null;
    }
    currentSlot = -1;
    if (dynamicControls)
        dynamicControls.innerHTML = "";
});
// --- 2. Dynamic UI Generation ---
function buildDynamicUI(blueprint) {
    if (!dynamicControls)
        return;
    dynamicControls.innerHTML = "";
    blueprint.forEach(control => {
        const wrapper = document.createElement('div');
        wrapper.className = 'dynamic-control-wrapper';
        if (control.type === 'button') {
            const btn = document.createElement('button');
            btn.className = 'action-btn mat-elevation-z1';
            btn.style.backgroundColor = control.color;
            btn.innerHTML = `<span class="btn-title">${control.label}</span>`;
            const sendState = (state) => {
                if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
                    ws.send(JSON.stringify({ type: 'control', id: control.id, value: state }));
                }
            };
            const triggerPress = (e) => { e.preventDefault(); btn.classList.add('is-active'); sendState(1); };
            const triggerRelease = (e) => { e.preventDefault(); btn.classList.remove('is-active'); sendState(0); };
            btn.addEventListener('mousedown', triggerPress);
            btn.addEventListener('touchstart', triggerPress, { passive: false });
            // Hardened release triggers
            btn.addEventListener('mouseup', triggerRelease);
            btn.addEventListener('mouseleave', triggerRelease);
            btn.addEventListener('touchend', triggerRelease);
            btn.addEventListener('touchcancel', triggerRelease);
            btn.addEventListener('contextmenu', e => e.preventDefault()); // Prevent iOS callouts
            wrapper.appendChild(btn);
        }
        else if (control.type === 'slider') {
            const label = document.createElement('label');
            label.innerText = control.label;
            label.style.color = '#fff';
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.fontSize = '1.2rem';
            label.style.fontWeight = 'bold';
            label.style.textTransform = 'uppercase';
            label.style.letterSpacing = '1px';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = control.min.toString();
            slider.max = control.max.toString();
            slider.step = control.step.toString();
            slider.value = control.default_val.toString();
            slider.style.width = '100%';
            slider.addEventListener('input', (e) => {
                if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
                    ws.send(JSON.stringify({ type: 'control', id: control.id, value: parseFloat(e.target.value) }));
                }
            });
            wrapper.appendChild(label);
            wrapper.appendChild(slider);
        }
        else if (control.type === 'dpad') {
            // Create a classic D-Pad
            const dpadContainer = document.createElement('div');
            dpadContainer.className = 'dpad-container';
            dpadContainer.innerHTML = `
                <div class="dpad-row"><button class="dpad-btn up">▲</button></div>
                <div class="dpad-row"><button class="dpad-btn left">◀</button><div class="dpad-center"></div><button class="dpad-btn right">▶</button></div>
                <div class="dpad-row"><button class="dpad-btn down">▼</button></div>
            `;
            const up = dpadContainer.querySelector('.up');
            const down = dpadContainer.querySelector('.down');
            const left = dpadContainer.querySelector('.left');
            const right = dpadContainer.querySelector('.right');
            const activeDpad = { up: false, down: false, left: false, right: false };
            const updateDpadOut = () => {
                outX = (activeDpad.right ? 1 : 0) - (activeDpad.left ? 1 : 0);
                outY = (activeDpad.up ? 1 : 0) - (activeDpad.down ? 1 : 0);
            };
            const bindDpad = (btn, key) => {
                const press = (e) => {
                    e.preventDefault();
                    btn.style.transform = 'scale(0.9)';
                    activeDpad[key] = true;
                    updateDpadOut();
                };
                const release = (e) => {
                    e.preventDefault();
                    btn.style.transform = 'scale(1)';
                    activeDpad[key] = false;
                    updateDpadOut();
                };
                btn.addEventListener('mousedown', press);
                btn.addEventListener('touchstart', press, { passive: false });
                btn.addEventListener('mouseup', release);
                btn.addEventListener('mouseleave', release);
                btn.addEventListener('touchend', release);
                btn.addEventListener('touchcancel', release);
                btn.addEventListener('contextmenu', e => e.preventDefault());
            };
            bindDpad(up, 'up');
            bindDpad(down, 'down');
            bindDpad(left, 'left');
            bindDpad(right, 'right');
            wrapper.appendChild(dpadContainer);
        }
        dynamicControls.appendChild(wrapper);
    });
}
// --- 3. Joystick & Resize Logic ---
function initJoystick() {
    if (joystick)
        joystick.destroy();
    const joySize = Math.min(window.innerWidth / 2, 350); // Massive joystick!
    joystick = nipplejs.create({
        zone: joystickZone,
        mode: 'dynamic',
        color: '#ffffff', // High visibility white on dark background
        size: joySize
    });
    joystick.on('move', (evt, data) => {
        if (!data || !data.angle)
            return;
        const radius = data.instance.options.size / 2;
        outX = data.distance * Math.cos(data.angle.radian) / radius;
        outY = data.distance * Math.sin(data.angle.radian) / radius; // Fixed inverted Y axis
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
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN))
        return;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
    const host = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `wss://grades-louis-associate-outlet.trycloudflare.com`;
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
    ws.onmessage = (msg) => {
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
        }
        catch (e) { }
    };
    ws.onclose = () => {
        isLooping = false; // MUST reset loop flag for reconnects
        if (ui.style.display === 'flex' && !isRejected) {
            slotIndicator.innerText = "Disconnected. Reconnecting...";
            slotIndicator.style.color = '#ea4335';
            currentSlot = -1;
            reconnectTimer = setTimeout(connectWS, 2000 + Math.random() * 1000);
        }
    };
}
// --- 5. Network Loop ---
let lastFrameTime = 0;
function networkLoop(timestamp) {
    if (!ws || ws.readyState !== WebSocket.OPEN)
        return;
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
    if (ws && ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'ping' }));
}, 5000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ui.style.display === 'flex') {
        if (!ws || ws.readyState !== WebSocket.OPEN)
            connectWS();
    }
});
