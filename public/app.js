let ws = null;
let currentSlot = -1;
let currentProfile = "gamepad";
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
const controlArea = document.getElementById('control-area');
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
const protocol = window.location.protocol;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrlBase = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `${wsProtocol}//${window.location.host}`;
const httpUrlBase = isLocal ? `http://${hostname || '127.0.0.1'}:8080` : `${protocol}//${window.location.host}`;
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
// --- Joining and Exiting ---
joinBtn.addEventListener('click', () => {
    let rawName = nameInput.value.trim();
    if (rawName === "") {
        rawName = "Player_" + Math.floor(Math.random() * 9000 + 1000);
    }
    playerName = rawName.substring(0, 12);
    errorMsg.innerText = "";
    isRejected = false;
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(console.error);
    }
    gate.style.display = 'none';
    ui.style.display = 'flex';
    connectWS();
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
    teardownActiveProfile();
    currentSlot = -1;
});
function flushInputs() {
    outX = 0;
    outY = 0;
    lastSentX = -1;
    lastSentY = -1;
    if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
        ws.send(JSON.stringify({ type: 'flush' }));
    }
}
function teardownActiveProfile() {
    if (joystick) {
        joystick.destroy();
        joystick = null;
    }
    if (controlArea) {
        controlArea.innerHTML = "";
    }
}
// --- Dynamic Profile Switching ---
function renderProfile(profileType, blueprint) {
    flushInputs();
    currentProfile = profileType;
    if (!controlArea)
        return;
    controlArea.classList.add('profile-fading');
    setTimeout(() => {
        teardownActiveProfile();
        switch (profileType) {
            case 'touchpad':
                mountTouchpad(blueprint);
                break;
            case 'faderbank':
                mountFaderbank(blueprint);
                break;
            case 'audience':
                mountAudience(blueprint);
                break;
            case 'gamepad':
            default:
                mountGamepad(blueprint);
                break;
        }
        controlArea.classList.remove('profile-fading');
    }, 70);
}
// 1. GAMEPAD MOUNT
function mountGamepad(blueprint) {
    const joyZone = document.createElement('div');
    joyZone.id = 'joystick-zone';
    controlArea.appendChild(joyZone);
    const dynamicControls = document.createElement('div');
    dynamicControls.id = 'dynamic-controls';
    dynamicControls.className = 'controls-grid';
    controlArea.appendChild(dynamicControls);
    initJoystick(joyZone);
    buildDynamicControls(dynamicControls, blueprint);
}
function initJoystick(zoneEl) {
    if (joystick)
        joystick.destroy();
    const joySize = Math.min(window.innerWidth / 2, 340);
    joystick = nipplejs.create({
        zone: zoneEl,
        mode: 'dynamic',
        color: '#ffffff',
        size: joySize
    });
    joystick.on('move', (evt, data) => {
        if (!data || !data.angle)
            return;
        const radius = data.instance.options.size / 2;
        outX = data.distance * Math.cos(data.angle.radian) / radius;
        outY = data.distance * Math.sin(data.angle.radian) / radius;
    });
    joystick.on('end', () => {
        outX = 0;
        outY = 0;
    });
}
// 2. TOUCHPAD / CANVAS MOUNT
function mountTouchpad(blueprint) {
    const container = document.createElement('div');
    container.className = 'touchpad-container';
    const topBar = document.createElement('div');
    topBar.className = 'touchpad-top-bar';
    const badge = document.createElement('div');
    badge.className = 'touchpad-badge';
    badge.innerText = 'X: 0.00 | Y: 0.00';
    topBar.appendChild(badge);
    // Top action buttons
    blueprint.filter(c => c.type === 'button').forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'mat-btn mat-secondary';
        btn.innerText = c.label;
        btn.style.borderColor = c.color || '#4285f4';
        btn.style.color = '#fff';
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); sendControl(c.id, 1); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); sendControl(c.id, 0); });
        btn.addEventListener('mousedown', () => sendControl(c.id, 1));
        btn.addEventListener('mouseup', () => sendControl(c.id, 0));
        topBar.appendChild(btn);
    });
    container.appendChild(topBar);
    const canvas = document.createElement('canvas');
    canvas.className = 'touchpad-canvas';
    container.appendChild(canvas);
    controlArea.appendChild(container);
    const ctx = canvas.getContext('2d');
    let isTouching = false;
    let touchX = 0;
    let touchY = 0;
    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        drawTouchpad();
    }
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 50);
    function drawTouchpad() {
        if (!ctx)
            return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Center crosshairs
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        if (isTouching) {
            // Glowing touch indicator
            const grad = ctx.createRadialGradient(touchX, touchY, 5, touchX, touchY, 40);
            grad.addColorStop(0, 'rgba(66, 133, 244, 0.9)');
            grad.addColorStop(1, 'rgba(66, 133, 244, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(touchX, touchY, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(touchX, touchY, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    function handlePointer(e) {
        const rect = canvas.getBoundingClientRect();
        touchX = e.clientX - rect.left;
        touchY = e.clientY - rect.top;
        // Normalize to [-1.0, 1.0] (center is 0, 0, Y positive is up)
        const normX = ((touchX / canvas.width) * 2 - 1);
        const normY = -((touchY / canvas.height) * 2 - 1);
        outX = Math.max(-1, Math.min(1, normX));
        outY = Math.max(-1, Math.min(1, normY));
        badge.innerText = `X: ${outX >= 0 ? '+' : ''}${outX.toFixed(2)} | Y: ${outY >= 0 ? '+' : ''}${outY.toFixed(2)}`;
        drawTouchpad();
    }
    canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        isTouching = true;
        sendControl('b1', 1);
        handlePointer(e);
    });
    canvas.addEventListener('pointermove', (e) => {
        if (isTouching)
            handlePointer(e);
    });
    const pointerUp = (e) => {
        if (isTouching) {
            isTouching = false;
            sendControl('b1', 0);
            outX = 0;
            outY = 0;
            badge.innerText = 'X: 0.00 | Y: 0.00';
            drawTouchpad();
        }
    };
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
}
// 3. FADER BANK MOUNT
function mountFaderbank(blueprint) {
    const container = document.createElement('div');
    container.className = 'faderbank-container';
    const fadersRow = document.createElement('div');
    fadersRow.className = 'faders-row';
    const sliders = blueprint.filter(c => c.type === 'slider');
    sliders.forEach((c) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'v-fader-wrapper';
        const badge = document.createElement('span');
        badge.className = 'fader-badge';
        let curVal = c.default_val !== undefined ? c.default_val : 0.5;
        badge.innerText = Math.round(curVal * 100) + '%';
        const track = document.createElement('div');
        track.className = 'fader-track';
        const fill = document.createElement('div');
        fill.className = 'fader-fill';
        fill.style.backgroundColor = c.color || '#4285f4';
        fill.style.height = `${curVal * 100}%`;
        track.appendChild(fill);
        const label = document.createElement('span');
        label.className = 'fader-label';
        label.innerText = c.label;
        // Touch scrubbing for vertical fader
        function updateFader(e) {
            const rect = track.getBoundingClientRect();
            const relY = rect.bottom - e.clientY;
            let norm = relY / rect.height;
            norm = Math.max(0, Math.min(1, norm));
            curVal = norm;
            fill.style.height = `${norm * 100}%`;
            badge.innerText = Math.round(norm * 100) + '%';
            sendControl(c.id, norm);
        }
        track.addEventListener('pointerdown', (e) => {
            track.setPointerCapture(e.pointerId);
            updateFader(e);
        });
        track.addEventListener('pointermove', (e) => {
            if (e.buttons > 0)
                updateFader(e);
        });
        wrapper.appendChild(badge);
        wrapper.appendChild(track);
        wrapper.appendChild(label);
        fadersRow.appendChild(wrapper);
    });
    container.appendChild(fadersRow);
    // Bottom Flash Pads
    const padsRow = document.createElement('div');
    padsRow.className = 'fader-pads-row';
    const buttons = blueprint.filter(c => c.type === 'button');
    buttons.forEach((c) => {
        const pad = document.createElement('button');
        pad.className = 'fader-flash-pad';
        pad.innerText = c.label;
        pad.style.backgroundColor = c.color || '#4285f4';
        const press = (e) => { e.preventDefault(); sendControl(c.id, 1); };
        const release = (e) => { e.preventDefault(); sendControl(c.id, 0); };
        pad.addEventListener('pointerdown', press);
        pad.addEventListener('pointerup', release);
        pad.addEventListener('pointercancel', release);
        padsRow.appendChild(pad);
    });
    container.appendChild(padsRow);
    controlArea.appendChild(container);
}
// 4. AUDIENCE HYPE MOUNT
function mountAudience(blueprint) {
    const container = document.createElement('div');
    container.className = 'audience-container';
    // Tap BPM Stats
    const stats = document.createElement('div');
    stats.className = 'hype-stats';
    const bpmDisplay = document.createElement('h2');
    bpmDisplay.className = 'hype-bpm';
    bpmDisplay.innerText = '0 BPM';
    const subLabel = document.createElement('div');
    subLabel.className = 'hype-label';
    subLabel.innerText = 'Tap Rhythm / Energy';
    stats.appendChild(bpmDisplay);
    stats.appendChild(subLabel);
    container.appendChild(stats);
    // Big Center Tap Button
    let tapTimes = [];
    let totalTaps = 0;
    const tapBtn = document.createElement('div');
    tapBtn.className = 'hype-tap-btn';
    tapBtn.innerHTML = `
        <span class="hype-btn-text">PULSE</span>
        <span class="hype-taps-count">0 taps</span>
    `;
    const countDisplay = tapBtn.querySelector('.hype-taps-count');
    tapBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        totalTaps++;
        countDisplay.innerText = `${totalTaps} taps`;
        const now = Date.now();
        tapTimes.push(now);
        // Keep last 6 taps
        if (tapTimes.length > 6)
            tapTimes.shift();
        let bpm = 0;
        if (tapTimes.length > 1) {
            const intervals = [];
            for (let i = 1; i < tapTimes.length; i++) {
                intervals.push(tapTimes[i] - tapTimes[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            if (avgInterval > 0) {
                bpm = Math.round(60000 / avgInterval);
            }
        }
        bpmDisplay.innerText = `${bpm} BPM`;
        if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
            ws.send(JSON.stringify({ type: 'tap', rate: bpm }));
        }
    });
    container.appendChild(tapBtn);
    // Reactions Bar
    const reactions = blueprint.filter(c => c.type === 'reaction' || c.emoji);
    if (reactions.length > 0) {
        const reactBar = document.createElement('div');
        reactBar.className = 'reactions-bar';
        reactions.forEach((c) => {
            const rBtn = document.createElement('button');
            rBtn.className = 'reaction-btn';
            rBtn.innerText = c.emoji || c.label;
            rBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                sendControl(c.id, 1);
                setTimeout(() => sendControl(c.id, 0), 100);
            });
            reactBar.appendChild(rBtn);
        });
        container.appendChild(reactBar);
    }
    controlArea.appendChild(container);
}
// Generic control sender
function sendControl(id, value) {
    if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
        ws.send(JSON.stringify({ type: 'control', id, value }));
    }
}
// Common Dynamic Blueprint Builder
function buildDynamicControls(parentEl, blueprint) {
    parentEl.innerHTML = "";
    blueprint.forEach(control => {
        const wrapper = document.createElement('div');
        wrapper.className = 'dynamic-control-wrapper';
        if (control.type === 'button') {
            const btn = document.createElement('button');
            btn.className = 'action-btn mat-elevation-z1';
            btn.style.backgroundColor = control.color || '#4285f4';
            btn.innerHTML = `<span class="btn-title">${control.label}</span>`;
            const triggerPress = (e) => { e.preventDefault(); btn.classList.add('is-active'); sendControl(control.id, 1); };
            const triggerRelease = (e) => { e.preventDefault(); btn.classList.remove('is-active'); sendControl(control.id, 0); };
            btn.addEventListener('mousedown', triggerPress);
            btn.addEventListener('touchstart', triggerPress, { passive: false });
            btn.addEventListener('mouseup', triggerRelease);
            btn.addEventListener('mouseleave', triggerRelease);
            btn.addEventListener('touchend', triggerRelease);
            btn.addEventListener('touchcancel', triggerRelease);
            btn.addEventListener('contextmenu', e => e.preventDefault());
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
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = control.min.toString();
            slider.max = control.max.toString();
            slider.step = control.step.toString();
            slider.value = control.default_val.toString();
            slider.style.width = '100%';
            slider.addEventListener('input', (e) => {
                sendControl(control.id, parseFloat(e.target.value));
            });
            wrapper.appendChild(label);
            wrapper.appendChild(slider);
        }
        parentEl.appendChild(wrapper);
    });
}
// --- WebSocket Handshake & Handlers ---
function connectWS() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN))
        return;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    const host = wsUrlBase;
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
                slotIndicator.innerText = `${playerName} (Slot ${currentSlot})`;
                slotIndicator.style.color = '#34a853';
                renderProfile(data.profile_type || data.profile || 'gamepad', data.ui_blueprint || []);
            }
            if (data.type === 'profile_change') {
                renderProfile(data.profile_type || data.profile, data.ui_blueprint || []);
            }
            if (data.type === 'rejected') {
                isRejected = true;
                errorMsg.innerText = data.reason || "Installation Full!";
                exitBtn.click();
            }
        }
        catch (e) { }
    };
    ws.onclose = () => {
        isLooping = false;
        if (ui.style.display === 'flex' && !isRejected) {
            slotIndicator.innerText = "Disconnected. Reconnecting...";
            slotIndicator.style.color = '#ea4335';
            currentSlot = -1;
            reconnectTimer = setTimeout(connectWS, 2000 + Math.random() * 1000);
        }
    };
}
// 60Hz Network Loop
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
}, 4000);
// Auto-zero inputs when phone sleeps or tab blurs
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushInputs();
    }
    else if (document.visibilityState === 'visible' && ui.style.display === 'flex') {
        if (!ws || ws.readyState !== WebSocket.OPEN)
            connectWS();
    }
});
