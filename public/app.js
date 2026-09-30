// ============================================================================
// TDBRIDGE // SWISS GRAPHIC MONOLITH CLIENT APPLICATION
// Multi-touch, omni-device, 60Hz throttled performance controller.
// ============================================================================
let ws = null;
let currentSlot = -1;
let outX = 0;
let outY = 0;
let lastSentX = -999;
let lastSentY = -999;
let isLooping = false;
let playerName = "ANONYMOUS";
let selectedColorHex = "#00f0ff";
let selectedColorName = "CYAN";
let reconnectTimer = null;
// DOM Elements
const gate = document.getElementById('gate');
const ui = document.getElementById('ui');
const joinBtn = document.getElementById('join-btn');
const exitBtn = document.getElementById('exit-btn');
const slotIndicator = document.getElementById('slot-indicator');
const slotDot = document.getElementById('slot-dot');
const engineStatus = document.getElementById('engine-status');
const errorMsg = document.getElementById('error-msg');
const nameInput = document.getElementById('player-name');
const randomNameBtn = document.getElementById('random-name-btn');
const vectorReadout = document.getElementById('vector-readout');
const macroSlider = document.getElementById('macro-slider');
const sliderReadout = document.getElementById('slider-readout');
// Joystick Elements
const joystickBoundary = document.getElementById('joystick-boundary');
const joystickPuck = document.getElementById('joystick-puck');
const puckCenterDot = document.getElementById('puck-center-dot');
// Segmented Room Code Elements
const codeBoxes = [
    document.getElementById('code-0'),
    document.getElementById('code-1'),
    document.getElementById('code-2'),
    document.getElementById('code-3'),
];
const roomCodeHidden = document.getElementById('room-code-input');
// ============================================================================
// 1. INITIALIZATION & URL HANDLING
// ============================================================================
const urlParams = new URLSearchParams(window.location.search);
const initialRoom = (urlParams.get('room') || "").trim().toUpperCase();
if (initialRoom.length === 4) {
    for (let i = 0; i < 4; i++) {
        if (codeBoxes[i])
            codeBoxes[i].value = initialRoom[i];
    }
    if (roomCodeHidden)
        roomCodeHidden.value = initialRoom;
}
// Segmented Code Navigation & Clipboard Paste
codeBoxes.forEach((box, idx) => {
    if (!box)
        return;
    box.addEventListener('input', (e) => {
        const val = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        box.value = val.slice(0, 1);
        updateRoomCodeValue();
        if (box.value && idx < 3) {
            codeBoxes[idx + 1].focus();
        }
    });
    box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
            codeBoxes[idx - 1].focus();
        }
    });
    box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (pasted.length >= 4) {
            for (let i = 0; i < 4; i++) {
                if (codeBoxes[i])
                    codeBoxes[i].value = pasted[i];
            }
            updateRoomCodeValue();
            codeBoxes[3].focus();
        }
    });
});
function updateRoomCodeValue() {
    const code = codeBoxes.map(b => b?.value || '').join('').toUpperCase();
    if (roomCodeHidden)
        roomCodeHidden.value = code;
    return code;
}
// Random Handle Generator
const HANDLE_PREFIXES = ['NODE', 'VECTOR', 'AERO', 'PULSE', 'SIGNAL', 'VERTEX', 'MODEM', 'NEXUS'];
function generateRandomHandle() {
    const pre = HANDLE_PREFIXES[Math.floor(Math.random() * HANDLE_PREFIXES.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    nameInput.value = `${pre}_${num}`;
}
if (randomNameBtn) {
    randomNameBtn.addEventListener('click', generateRandomHandle);
}
// Color Swatch Selection
const swatches = document.querySelectorAll('.swatch');
const selectedColorLabel = document.getElementById('selected-color-name');
swatches.forEach(s => {
    s.addEventListener('click', () => {
        swatches.forEach(other => other.classList.remove('is-active'));
        s.classList.add('is-active');
        selectedColorHex = s.getAttribute('data-hex') || '#00f0ff';
        selectedColorName = s.getAttribute('data-name') || 'CYAN';
        if (selectedColorLabel) {
            selectedColorLabel.innerText = selectedColorName;
            selectedColorLabel.style.color = selectedColorHex;
        }
        if (slotDot)
            slotDot.style.backgroundColor = selectedColorHex;
        if (puckCenterDot)
            puckCenterDot.style.backgroundColor = selectedColorHex;
    });
});
// Dynamic Branding / Telemetry Ping
const hostname = window.location.hostname;
const protocol = window.location.protocol;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrlBase = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `${wsProtocol}//${window.location.host}`;
const httpUrlBase = isLocal ? `http://${hostname || '127.0.0.1'}:8080` : `${protocol}//${window.location.host}`;
fetch(`${httpUrlBase}/branding`)
    .then(r => r.json())
    .then(b => {
    const brandTitle = document.getElementById('brand-title');
    const brandSub = document.getElementById('brand-subtitle');
    if (brandTitle && b.project_name)
        brandTitle.innerText = b.project_name.toUpperCase();
    if (brandSub && b.subtitle)
        brandSub.innerText = b.subtitle.toUpperCase();
})
    .catch(() => { });
// ============================================================================
// 2. CONNECTION LIFECYCLE
// ============================================================================
joinBtn.addEventListener('click', () => {
    let raw = nameInput.value.trim().toUpperCase();
    if (!raw) {
        generateRandomHandle();
        raw = nameInput.value;
    }
    playerName = raw.substring(0, 12);
    const room = updateRoomCodeValue();
    if (room.length !== 4) {
        showError("PLEASE ENTER 4-CHARACTER ROOM CODE");
        return;
    }
    hideError();
    // Safe WakeLock
    if ('wakeLock' in navigator) {
        try {
            navigator.wakeLock.request('screen').catch(() => { });
        }
        catch (e) { }
    }
    gate.style.display = 'none';
    ui.style.display = 'flex';
    connectWS(room);
});
exitBtn.addEventListener('click', () => {
    flushInputs();
    if (ws)
        ws.close();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    ui.style.display = 'none';
    gate.style.display = 'flex';
    currentSlot = -1;
});
function showError(msg) {
    if (errorMsg) {
        errorMsg.innerText = `[!] ${msg}`;
        errorMsg.style.display = 'block';
    }
}
function hideError() {
    if (errorMsg)
        errorMsg.style.display = 'none';
}
function connectWS(roomCode) {
    slotIndicator.innerText = "CONNECTING...";
    ws = new WebSocket(wsUrlBase);
    ws.onopen = () => {
        slotIndicator.innerText = "LINKING...";
        ws?.send(JSON.stringify({
            type: 'join',
            name: playerName,
            room: roomCode,
            color_hex: selectedColorHex,
            color_name: selectedColorName
        }));
    };
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'assigned_slot') {
                currentSlot = data.slot;
                slotIndicator.innerText = `SLOT #${String(currentSlot).padStart(2, '0')}`;
                if (engineStatus)
                    engineStatus.innerText = "60.0 FPS // LIVE LINK";
                startInputLoop();
            }
            else if (data.type === 'error') {
                showError(data.message || 'CONNECTION ERROR');
                exitBtn.click();
            }
        }
        catch (e) { }
    };
    ws.onclose = () => {
        if (ui.style.display === 'flex') {
            slotIndicator.innerText = "DISCONNECTED";
            if (engineStatus)
                engineStatus.innerText = "OFFLINE // RETRYING";
            reconnectTimer = setTimeout(() => connectWS(roomCode), 2000);
        }
    };
}
function flushInputs() {
    outX = 0;
    outY = 0;
    lastSentX = -999;
    lastSentY = -999;
    if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
        ws.send(JSON.stringify({ type: 'flush' }));
    }
}
// ============================================================================
// 3. ANALOG JOYSTICK WITH POINTER CAPTURE & MULTI-TOUCH
// ============================================================================
let isDraggingJoy = false;
let joyPointerId = -1;
let joyBounds = null;
function updateJoyBounds() {
    if (joystickBoundary) {
        joyBounds = joystickBoundary.getBoundingClientRect();
    }
}
window.addEventListener('resize', updateJoyBounds);
window.addEventListener('orientationchange', updateJoyBounds);
if (joystickBoundary) {
    joystickBoundary.addEventListener('pointerdown', (e) => {
        isDraggingJoy = true;
        joyPointerId = e.pointerId;
        try {
            joystickBoundary.setPointerCapture(e.pointerId);
        }
        catch (err) { }
        updateJoyBounds();
        handleJoyMove(e);
    });
    joystickBoundary.addEventListener('pointermove', (e) => {
        if (!isDraggingJoy || e.pointerId !== joyPointerId)
            return;
        handleJoyMove(e);
    });
    const resetJoy = (e) => {
        if (e.pointerId !== joyPointerId && joyPointerId !== -1)
            return;
        isDraggingJoy = false;
        joyPointerId = -1;
        outX = 0;
        outY = 0;
        if (joystickPuck) {
            joystickPuck.style.transform = `translate(0px, 0px)`;
        }
        if (vectorReadout) {
            vectorReadout.innerText = `X: +0.00 | Y: +0.00`;
        }
    };
    joystickBoundary.addEventListener('pointerup', resetJoy);
    joystickBoundary.addEventListener('pointercancel', resetJoy);
    joystickBoundary.addEventListener('lostpointercapture', resetJoy);
}
function handleJoyMove(e) {
    if (!joyBounds)
        updateJoyBounds();
    if (!joyBounds)
        return;
    const centerX = joyBounds.left + joyBounds.width / 2;
    const centerY = joyBounds.top + joyBounds.height / 2;
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    const maxRadius = Math.max(10, joyBounds.width / 2 - 30);
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
    }
    if (joystickPuck) {
        joystickPuck.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    outX = Math.max(-1, Math.min(1, dx / maxRadius));
    outY = Math.max(-1, Math.min(1, -dy / maxRadius)); // Inverted Y for standard Cartesian
    if (vectorReadout) {
        const sx = (outX >= 0 ? '+' : '') + outX.toFixed(2);
        const sy = (outY >= 0 ? '+' : '') + outY.toFixed(2);
        vectorReadout.innerText = `X: ${sx} | Y: ${sy}`;
    }
}
// ============================================================================
// 4. ACTION TRIGGERS & MACRO SLIDER
// ============================================================================
const actionButtons = document.querySelectorAll('.action-btn');
actionButtons.forEach(btn => {
    const id = btn.getAttribute('data-id') || 'b1';
    const press = (e) => {
        e.preventDefault();
        btn.classList.add('is-active');
        sendControl(id, 1);
        safeHaptic();
    };
    const release = (e) => {
        e.preventDefault();
        btn.classList.remove('is-active');
        sendControl(id, 0);
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
});
if (macroSlider) {
    macroSlider.addEventListener('input', () => {
        const val = Number(macroSlider.value);
        if (sliderReadout)
            sliderReadout.innerText = `${val}%`;
        sendControl('s1', val / 100);
    });
}
function safeHaptic() {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(12);
        }
        catch (e) { }
    }
}
function sendControl(id, value) {
    if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
        ws.send(JSON.stringify({ type: 'control', id, value }));
    }
}
// ============================================================================
// 5. DESKTOP KEYBOARD BINDINGS (WASD, 1-4, SPACE)
// ============================================================================
let keyState = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    // Only capture when controller UI is visible and focus is not on an input field
    if (ui.style.display !== 'flex')
        return;
    const tag = (document.activeElement?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA')
        return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp')
        keyState.w = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown')
        keyState.s = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')
        keyState.a = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight')
        keyState.d = true;
    if (e.code === 'Digit1')
        triggerVirtualButton('b1', true);
    if (e.code === 'Digit2')
        triggerVirtualButton('b2', true);
    if (e.code === 'Digit3')
        triggerVirtualButton('b3', true);
    if (e.code === 'Digit4' || e.code === 'Space')
        triggerVirtualButton('b4', true);
    updateKeyboardVector();
});
window.addEventListener('keyup', (e) => {
    if (ui.style.display !== 'flex')
        return;
    const tag = (document.activeElement?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA')
        return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp')
        keyState.w = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown')
        keyState.s = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft')
        keyState.a = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight')
        keyState.d = false;
    if (e.code === 'Digit1')
        triggerVirtualButton('b1', false);
    if (e.code === 'Digit2')
        triggerVirtualButton('b2', false);
    if (e.code === 'Digit3')
        triggerVirtualButton('b3', false);
    if (e.code === 'Digit4' || e.code === 'Space')
        triggerVirtualButton('b4', false);
    updateKeyboardVector();
});
function updateKeyboardVector() {
    if (isDraggingJoy)
        return; // Touch joystick takes priority
    let kx = 0;
    let ky = 0;
    if (keyState.d)
        kx += 1.0;
    if (keyState.a)
        kx -= 1.0;
    if (keyState.w)
        ky += 1.0;
    if (keyState.s)
        ky -= 1.0;
    const mag = Math.hypot(kx, ky);
    if (mag > 1.0) {
        kx /= mag;
        ky /= mag;
    }
    outX = kx;
    outY = ky;
    if (joystickPuck) {
        const radius = 60;
        joystickPuck.style.transform = `translate(${kx * radius}px, ${-ky * radius}px)`;
    }
    if (vectorReadout) {
        const sx = (outX >= 0 ? '+' : '') + outX.toFixed(2);
        const sy = (outY >= 0 ? '+' : '') + outY.toFixed(2);
        vectorReadout.innerText = `X: ${sx} | Y: ${sy}`;
    }
}
function triggerVirtualButton(id, active) {
    const el = document.getElementById(`btn-${id}`);
    if (el) {
        if (active)
            el.classList.add('is-active');
        else
            el.classList.remove('is-active');
    }
    sendControl(id, active ? 1 : 0);
    if (active)
        safeHaptic();
}
// ============================================================================
// 6. 60Hz THROTTLED INPUT TRANSMISSION LOOP
// ============================================================================
function startInputLoop() {
    if (isLooping)
        return;
    isLooping = true;
    setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN || currentSlot === -1)
            return;
        // Only send if values changed significantly (> 0.005) or returning to 0
        const deltaX = Math.abs(outX - lastSentX);
        const deltaY = Math.abs(outY - lastSentY);
        if (deltaX > 0.005 || deltaY > 0.005 || (outX === 0 && lastSentX !== 0) || (outY === 0 && lastSentY !== 0)) {
            ws.send(JSON.stringify({
                type: 'input',
                x: Number(outX.toFixed(4)),
                y: Number(outY.toFixed(4))
            }));
            lastSentX = outX;
            lastSentY = outY;
        }
    }, 16); // ~60Hz
}
