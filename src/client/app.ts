// ============================================================================
// TDBRIDGE // SWISS GRAPHIC MONOLITH CLIENT APPLICATION
// Multi-touch, role-based, real RTT telemetry, 60Hz performance controller.
// ============================================================================

let ws: WebSocket | null = null;
let currentSlot: number = -1;
let currentRole: string = "performer";
let outX: number = 0;
let outY: number = 0;
let lastSentX: number = -999;
let lastSentY: number = -999;
let isLooping: boolean = false;
let playerName: string = "ANONYMOUS";
let selectedColorHex: string = "#00f0ff";
let selectedColorName: string = "CYAN";
let reconnectTimer: any = null;
let pingIntervalTimer: any = null;
let lastPingSentTime: number = 0;
let currentRtt: number = 0;

// DOM Elements
const gate = document.getElementById('gate') as HTMLDivElement;
const ui = document.getElementById('ui') as HTMLDivElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const exitBtn = document.getElementById('exit-btn') as HTMLButtonElement;
const slotIndicator = document.getElementById('slot-indicator') as HTMLSpanElement;
const slotDot = document.getElementById('slot-dot') as HTMLSpanElement;
const rttStatus = document.getElementById('rtt-status') as HTMLSpanElement;
const gateTelemetry = document.getElementById('gate-telemetry') as HTMLSpanElement;
const errorMsg = document.getElementById('error-msg') as HTMLDivElement;
const nameInput = document.getElementById('player-name') as HTMLInputElement;
const randomNameBtn = document.getElementById('random-name-btn') as HTMLButtonElement;
const vectorReadout = document.getElementById('vector-readout') as HTMLSpanElement;

// Sliders: s1 (Speed) and s2 (Size)
const sliderS1 = document.getElementById('slider-s1') as HTMLInputElement;
const sliderS1Readout = document.getElementById('slider-s1-readout') as HTMLSpanElement;
const sliderS2 = document.getElementById('slider-s2') as HTMLInputElement;
const sliderS2Readout = document.getElementById('slider-s2-readout') as HTMLSpanElement;

// Joystick Elements
const joystickBoundary = document.getElementById('joystick-boundary') as HTMLDivElement;
const joystickPuck = document.getElementById('joystick-puck') as HTMLDivElement;
const puckCenterDot = document.getElementById('puck-center-dot') as HTMLDivElement;
const vectorCanvas = document.getElementById('vector-canvas') as HTMLCanvasElement;
const vctx = vectorCanvas ? vectorCanvas.getContext('2d') : null;

// Views
const viewPerformer = document.getElementById('view-performer') as HTMLDivElement;
const viewMaster = document.getElementById('view-master') as HTMLDivElement;
const viewAudience = document.getElementById('view-audience') as HTMLDivElement;

// Segmented Room Code Elements
const codeBoxes = [
    document.getElementById('code-0') as HTMLInputElement,
    document.getElementById('code-1') as HTMLInputElement,
    document.getElementById('code-2') as HTMLInputElement,
    document.getElementById('code-3') as HTMLInputElement,
];
const roomCodeHidden = document.getElementById('room-code-input') as HTMLInputElement;

// ============================================================================
// 1. INITIALIZATION & URL HANDLING
// ============================================================================

// Dynamic Branding & Host Resolution
const hostname = window.location.hostname;
const protocol = window.location.protocol;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrlBase = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `${wsProtocol}//${window.location.host}`;
const httpUrlBase = isLocal ? `http://${hostname || '127.0.0.1'}:8080` : `${protocol}//${window.location.host}`;

const urlParams = new URLSearchParams(window.location.search);
const initialRoom = (urlParams.get('room') || "").trim().toUpperCase();

if (initialRoom.length === 4) {
    for (let i = 0; i < 4; i++) {
        if (codeBoxes[i]) codeBoxes[i].value = initialRoom[i];
    }
    if (roomCodeHidden) roomCodeHidden.value = initialRoom;
} else {
    fetch(`${httpUrlBase}/room`)
        .then(r => r.json())
        .then(d => {
            if (d.room && d.room.length === 4) {
                for (let i = 0; i < 4; i++) {
                    if (codeBoxes[i] && !codeBoxes[i].value) codeBoxes[i].value = d.room[i];
                }
                if (roomCodeHidden && !roomCodeHidden.value) roomCodeHidden.value = d.room;
            }
        })
        .catch(() => {});
}

codeBoxes.forEach((box, idx) => {
    if (!box) return;

    box.addEventListener('input', () => {
        const val = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        box.value = val.slice(0, 1);
        updateRoomCodeValue();
        if (box.value && idx < 3) {
            codeBoxes[idx + 1].focus();
        }
    });

    box.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
            codeBoxes[idx - 1].focus();
        }
    });

    box.addEventListener('paste', (e: ClipboardEvent) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (pasted.length >= 4) {
            for (let i = 0; i < 4; i++) {
                if (codeBoxes[i]) codeBoxes[i].value = pasted[i];
            }
            updateRoomCodeValue();
            codeBoxes[3].focus();
        }
    });
});

function updateRoomCodeValue(): string {
    const code = codeBoxes.map(b => b?.value || '').join('').toUpperCase();
    if (roomCodeHidden) roomCodeHidden.value = code;
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
        if (slotDot) slotDot.style.backgroundColor = selectedColorHex;
        if (puckCenterDot) puckCenterDot.style.backgroundColor = selectedColorHex;
    });
});

// Role Selection in Gate
const gateRoleBtns = document.querySelectorAll('.role-select-btn');
const selectedRoleName = document.getElementById('selected-role-name');
const swatchSection = document.getElementById('swatch-section');

gateRoleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        gateRoleBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        currentRole = btn.getAttribute('data-role') || 'performer';
        if (selectedRoleName) selectedRoleName.innerText = currentRole.toUpperCase();
        if (swatchSection) {
            swatchSection.style.display = currentRole === 'performer' ? 'block' : 'none';
        }
    });
});

// In-Session Role Navigation Tabs
const roleNavTabs = document.querySelectorAll('.role-nav-tab');
roleNavTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        roleNavTabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const view = tab.getAttribute('data-view') || 'performer';
        switchActiveRoleView(view);
    });
});

function switchActiveRoleView(view: string) {
    if (viewPerformer) viewPerformer.style.display = view === 'performer' ? 'flex' : 'none';
    if (viewMaster) viewMaster.style.display = view === 'master' ? 'flex' : 'none';
    if (viewAudience) viewAudience.style.display = view === 'audience' ? 'flex' : 'none';
    if (view === 'performer') resizeCanvas();
}

fetch(`${httpUrlBase}/branding`)
    .then(r => r.json())
    .then(b => {
        const brandTitle = document.getElementById('brand-title');
        const brandSub = document.getElementById('brand-subtitle');
        if (brandTitle && b.project_name) brandTitle.innerText = b.project_name.toUpperCase();
        if (brandSub && b.subtitle) brandSub.innerText = b.subtitle.toUpperCase();
    })
    .catch(() => {});

// ============================================================================
// 2. CONNECTION LIFECYCLE & REAL RTT PING
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

    if ('wakeLock' in navigator) {
        try {
            (navigator as any).wakeLock.request('screen').catch(() => {});
        } catch (e) {}
    }

    gate.style.display = 'none';
    ui.style.display = 'flex';
    switchActiveRoleView(currentRole);
    connectWS(room);
});

exitBtn.addEventListener('click', () => {
    flushInputs();
    if (ws) ws.close();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (pingIntervalTimer) {
        clearInterval(pingIntervalTimer);
        pingIntervalTimer = null;
    }
    ui.style.display = 'none';
    gate.style.display = 'flex';
    currentSlot = -1;
});

function showError(msg: string) {
    if (errorMsg) {
        errorMsg.innerText = `[!] ${msg}`;
        errorMsg.style.display = 'block';
    }
}
function hideError() {
    if (errorMsg) errorMsg.style.display = 'none';
}

function connectWS(roomCode: string) {
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

        startPingLoop();
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'assigned_slot') {
                currentSlot = data.slot;
                slotIndicator.innerText = `SLOT #${String(currentSlot).padStart(2, '0')}`;
                startInputLoop();
            } else if (data.type === 'pong') {
                handlePong(data);
            } else if (data.type === 'error') {
                showError(data.message || 'CONNECTION ERROR');
                exitBtn.click();
            }
        } catch (e) {}
    };

    ws.onclose = () => {
        if (ui.style.display === 'flex') {
            slotIndicator.innerText = "DISCONNECTED";
            if (rttStatus) {
                rttStatus.innerText = "LINK: TIMEOUT // RETRYING";
                rttStatus.className = "hud-tag crimson";
            }
            reconnectTimer = setTimeout(() => connectWS(roomCode), 2000);
        }
    };
}

// Real RTT Ping/Pong Protocol
function startPingLoop() {
    if (pingIntervalTimer) clearInterval(pingIntervalTimer);
    pingIntervalTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        lastPingSentTime = performance.now();
        ws.send(JSON.stringify({ type: 'ping', t: lastPingSentTime }));
    }, 2000);
}

function handlePong(data: any) {
    const now = performance.now();
    const sentTime = Number(data.t || lastPingSentTime);
    currentRtt = Math.max(1, Math.round(now - sentTime));

    let tagClass = "hud-tag green";
    let statusText = `RTT: ${currentRtt}ms // SYNC`;

    if (currentRtt > 150) {
        tagClass = "hud-tag crimson";
        statusText = `RTT: ${currentRtt}ms // DEGRADED`;
    } else if (currentRtt > 60) {
        tagClass = "hud-tag amber";
        statusText = `RTT: ${currentRtt}ms // WI-FI`;
    }

    if (rttStatus) {
        rttStatus.innerText = statusText;
        rttStatus.className = tagClass;
    }
    if (gateTelemetry) {
        gateTelemetry.innerText = `LINK VERIFIED // RTT: ${currentRtt}ms`;
    }
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
// 3. ANALOG JOYSTICK & 60Hz VECTOR OSCILLOSCOPE
// ============================================================================

let isDraggingJoy = false;
let joyPointerId: number = -1;
let joyBounds: DOMRect | null = null;
const trailBuffer: { x: number; y: number }[] = [];

function updateJoyBounds() {
    if (joystickBoundary) {
        joyBounds = joystickBoundary.getBoundingClientRect();
    }
    resizeCanvas();
}
window.addEventListener('resize', updateJoyBounds);
window.addEventListener('orientationchange', updateJoyBounds);

function resizeCanvas() {
    if (!joystickBoundary || !vectorCanvas || !vctx) return;
    const rect = joystickBoundary.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    vectorCanvas.width = rect.width * dpr;
    vectorCanvas.height = rect.height * dpr;
    vctx.scale(dpr, dpr);
}

if (joystickBoundary) {
    joystickBoundary.addEventListener('pointerdown', (e: PointerEvent) => {
        isDraggingJoy = true;
        joyPointerId = e.pointerId;
        try {
            joystickBoundary.setPointerCapture(e.pointerId);
        } catch (err) {}
        updateJoyBounds();
        handleJoyMove(e);
    });

    joystickBoundary.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isDraggingJoy || e.pointerId !== joyPointerId) return;
        handleJoyMove(e);
    });

    const resetJoy = (e: PointerEvent) => {
        if (e.pointerId !== joyPointerId && joyPointerId !== -1) return;
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

function handleJoyMove(e: PointerEvent) {
    if (!joyBounds) updateJoyBounds();
    if (!joyBounds) return;

    const centerX = joyBounds.left + joyBounds.width / 2;
    const centerY = joyBounds.top + joyBounds.height / 2;
    
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;

    const maxRadius = Math.max(10, joyBounds.width / 2 - 28);
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
    }

    if (joystickPuck) {
        joystickPuck.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    outX = Math.max(-1, Math.min(1, dx / maxRadius));
    outY = Math.max(-1, Math.min(1, -dy / maxRadius));

    if (vectorReadout) {
        const sx = (outX >= 0 ? '+' : '') + outX.toFixed(2);
        const sy = (outY >= 0 ? '+' : '') + outY.toFixed(2);
        vectorReadout.innerText = `X: ${sx} | Y: ${sy}`;
    }

    trailBuffer.push({ x: joyBounds.width / 2 + dx, y: joyBounds.height / 2 + dy });
    if (trailBuffer.length > 24) trailBuffer.shift();
}

// 60Hz Oscilloscope Rendering Loop
function renderOscilloscope() {
    if (vectorCanvas && vctx && viewPerformer && viewPerformer.style.display !== 'none') {
        const rect = joystickBoundary ? joystickBoundary.getBoundingClientRect() : null;
        if (rect) {
            vctx.clearRect(0, 0, rect.width, rect.height);
            if (!isDraggingJoy && trailBuffer.length > 0) {
                trailBuffer.shift();
            }
            if (trailBuffer.length > 1) {
                vctx.beginPath();
                vctx.moveTo(trailBuffer[0].x, trailBuffer[0].y);
                for (let i = 1; i < trailBuffer.length; i++) {
                    vctx.lineTo(trailBuffer[i].x, trailBuffer[i].y);
                }
                vctx.strokeStyle = '#00e5ff';
                vctx.lineWidth = 1.5;
                vctx.stroke();

                const head = trailBuffer[trailBuffer.length - 1];
                vctx.beginPath();
                vctx.arc(head.x, head.y, 3, 0, Math.PI * 2);
                vctx.fillStyle = '#ffffff';
                vctx.fill();
            }
        }
    }
    requestAnimationFrame(renderOscilloscope);
}
requestAnimationFrame(renderOscilloscope);

// ============================================================================
// 4. TOUCHDESIGNER ACTIONS (b1..b4) & DUAL SLIDERS (s1, s2)
// ============================================================================

const actionButtons = document.querySelectorAll('.action-btn');
actionButtons.forEach(btn => {
    const id = btn.getAttribute('data-id') || 'b1';

    const press = (e: PointerEvent) => {
        e.preventDefault();
        btn.classList.add('is-active');
        sendControl(id, 1);
        safeHaptic();
    };

    const release = (e: PointerEvent) => {
        e.preventDefault();
        btn.classList.remove('is-active');
        sendControl(id, 0);
    };

    btn.addEventListener('pointerdown', press as any);
    btn.addEventListener('pointerup', release as any);
    btn.addEventListener('pointercancel', release as any);
});

// Dual Sliders
if (sliderS1) {
    sliderS1.addEventListener('input', () => {
        const val = Number(sliderS1.value);
        if (sliderS1Readout) sliderS1Readout.innerText = `${val}%`;
        sendControl('s1', val / 100);
    });
}

if (sliderS2) {
    sliderS2.addEventListener('input', () => {
        const val = Number(sliderS2.value);
        if (sliderS2Readout) sliderS2Readout.innerText = `${val}%`;
        sendControl('s2', val / 100);
    });
}

function safeHaptic() {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(12);
        } catch (e) {}
    }
}

function sendControl(id: string, value: number) {
    if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
        ws.send(JSON.stringify({ type: 'control', id, value }));
    }
}

// ============================================================================
// 5. MASTER OPERATOR CONSOLE ACTIONS (TIER 1)
// ============================================================================

const sceneButtons = document.querySelectorAll('.scene-btn');
sceneButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        sceneButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const sc = btn.getAttribute('data-scene') || 'aquarium';
        sendHostCommand('scene_switch', { scene: sc });
    });
});

const cueResetBtn = document.getElementById('cue-reset-btn');
if (cueResetBtn) {
    cueResetBtn.addEventListener('click', () => {
        sendHostCommand('system_reset', {});
    });
}

const cuePurgeBtn = document.getElementById('cue-purge-btn');
if (cuePurgeBtn) {
    cuePurgeBtn.addEventListener('click', () => {
        sendHostCommand('slot_purge', {});
    });
}

function sendHostCommand(action: string, extra: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'host_command',
            action,
            token: 'MASTER_KEY',
            ...extra
        }));
    }
}

// ============================================================================
// 6. AUDIENCE HYPE INTERACTIONS (TIER 3)
// ============================================================================

const audienceBpmBtn = document.getElementById('audience-bpm-tap');
const bpmNumber = document.getElementById('bpm-number');
let tapHistory: number[] = [];
let lastAudienceTap = 0;

if (audienceBpmBtn) {
    audienceBpmBtn.addEventListener('click', () => {
        const now = performance.now();
        if (lastAudienceTap > 0) {
            const dt = now - lastAudienceTap;
            if (dt > 200 && dt < 2000) {
                tapHistory.push(dt);
                if (tapHistory.length > 5) tapHistory.shift();
                const avg = tapHistory.reduce((a, b) => a + b, 0) / tapHistory.length;
                const bpm = Math.round(60000 / avg);
                if (bpmNumber) bpmNumber.innerText = String(bpm);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'tap', rate: bpm }));
                }
            }
        }
        lastAudienceTap = now;
        safeHaptic();
    });
}

const reactionTiles = document.querySelectorAll('.reaction-tile');
reactionTiles.forEach(tile => {
    tile.addEventListener('click', () => {
        const rx = tile.getAttribute('data-reaction') || 'fire';
        sendControl(`reaction_${rx}`, 1);
        safeHaptic();
    });
});

// ============================================================================
// 7. DESKTOP KEYBOARD BINDINGS (WASD, 1-4, SPACE)
// ============================================================================

let keyState = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (ui.style.display !== 'flex') return;
    const tag = (document.activeElement?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') { e.preventDefault(); keyState.w = true; }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') { e.preventDefault(); keyState.s = true; }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { e.preventDefault(); keyState.a = true; }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') { e.preventDefault(); keyState.d = true; }

    if (e.code === 'Digit1') { e.preventDefault(); triggerVirtualButton('b1', true); }
    if (e.code === 'Digit2') { e.preventDefault(); triggerVirtualButton('b2', true); }
    if (e.code === 'Digit3') { e.preventDefault(); triggerVirtualButton('b3', true); }
    if (e.code === 'Digit4' || e.code === 'Space') { e.preventDefault(); triggerVirtualButton('b4', true); }

    updateKeyboardVector();
});

window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (ui.style.display !== 'flex') return;
    const tag = (document.activeElement?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') keyState.w = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keyState.s = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keyState.a = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keyState.d = false;

    if (e.code === 'Digit1') triggerVirtualButton('b1', false);
    if (e.code === 'Digit2') triggerVirtualButton('b2', false);
    if (e.code === 'Digit3') triggerVirtualButton('b3', false);
    if (e.code === 'Digit4' || e.code === 'Space') triggerVirtualButton('b4', false);

    updateKeyboardVector();
});

function updateKeyboardVector() {
    if (isDraggingJoy) return;
    let kx = 0;
    let ky = 0;
    if (keyState.d) kx += 1.0;
    if (keyState.a) kx -= 1.0;
    if (keyState.w) ky += 1.0;
    if (keyState.s) ky -= 1.0;

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

function triggerVirtualButton(id: string, active: boolean) {
    const el = document.getElementById(`btn-${id}`);
    if (el) {
        if (active) el.classList.add('is-active');
        else el.classList.remove('is-active');
    }
    sendControl(id, active ? 1 : 0);
    if (active) safeHaptic();
}

// ============================================================================
// 8. 60Hz THROTTLED INPUT TRANSMISSION LOOP
// ============================================================================

function startInputLoop() {
    if (isLooping) return;
    isLooping = true;

    setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN || currentSlot === -1) return;

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
    }, 16);
}
