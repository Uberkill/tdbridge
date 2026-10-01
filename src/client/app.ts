// ============================================================================
// TDBRIDGE // SWISS GRAPHIC MONOLITH CLIENT APPLICATION
// Multi-touch, role-segregated, cryptographic master console, 60Hz input pipeline.
// ============================================================================

// ============================================================================
// 0. TELEMETRY & FLIGHT RECORDER (Global Exception Traps)
// ============================================================================
const recentErrorFingerprints = new Map<string, number>();
let errorBeaconCountThisMinute = 0;
let lastErrorMinuteTimestamp = Date.now();

function sendClientTelemetryError(msg: string, line?: number, col?: number, stack?: string) {
    const now = Date.now();
    if (now - lastErrorMinuteTimestamp > 60000) {
        errorBeaconCountThisMinute = 0;
        lastErrorMinuteTimestamp = now;
    }
    if (errorBeaconCountThisMinute >= 5) return; // Max 5 beacons/min rate limit

    const fingerprint = `${msg}:${line}:${col}`;
    const lastSent = recentErrorFingerprints.get(fingerprint) || 0;
    if (now - lastSent < 10000) return; // Deduplicate within 10s

    recentErrorFingerprints.set(fingerprint, now);
    errorBeaconCountThisMinute++;

    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify({
                type: 'client_telemetry_error',
                message: msg,
                line: line || null,
                col: col || null,
                stack: stack ? stack.substring(0, 300) : null,
                ua: navigator.userAgent
            }));
        } catch (e) {}
    }
}

window.onerror = (message, source, lineno, colno, error) => {
    sendClientTelemetryError(String(message), lineno, colno, error?.stack);
    return false;
};

window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    sendClientTelemetryError(`Unhandled Rejection: ${msg}`, undefined, undefined, stack);
};

let ws: WebSocket | null = null;
let currentSlot: number = -1;
let currentRole: 'performer' | 'audience' = 'performer';
let masterSessionToken: string | null = null;
let outX: number = 0;
let outY: number = 0;
let lastSentX: number = -999;
let lastSentY: number = -999;
let isLooping: boolean = false;
let playerName: string = "ANONYMOUS";
let selectedColorHex: string = "#00f0ff";
let selectedColorName: string = "CYAN";
let reconnectTimer: any = null;
let reconnectAttempts: number = 0;
const MAX_RECONNECT_ATTEMPTS: number = 5;
let pingIntervalTimer: any = null;
let lastPingSentTime: number = 0;
let currentRtt: number = 0;

// Top-Level View Containers
const gate = document.getElementById('gate') as HTMLDivElement;
const ui = document.getElementById('ui') as HTMLDivElement;
const masterUi = document.getElementById('master-ui') as HTMLDivElement;
const masterAuthModal = document.getElementById('master-auth-modal') as HTMLDivElement;

// General Lobby Controls
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
const swatchSection = document.getElementById('swatch-section') as HTMLDivElement;

// FOH Master Modal Controls
const openMasterModalBtn = document.getElementById('open-master-modal-btn') as HTMLButtonElement;
const masterAuthCancelBtn = document.getElementById('master-auth-cancel-btn') as HTMLButtonElement;
const masterAuthSubmitBtn = document.getElementById('master-auth-submit-btn') as HTMLButtonElement;
const masterRoomInput = document.getElementById('master-room-input') as HTMLInputElement;
const masterKeyInput = document.getElementById('master-key-input') as HTMLInputElement;
const masterErrorMsg = document.getElementById('master-error-msg') as HTMLDivElement;

// FOH Master Console Controls
const masterExitBtn = document.getElementById('master-exit-btn') as HTMLButtonElement;
const masterTdStatus = document.getElementById('master-td-status') as HTMLSpanElement;
const masterRttStatus = document.getElementById('master-rtt-status') as HTMLSpanElement;
const rosterCountBadge = document.getElementById('roster-count-badge') as HTMLSpanElement;
const masterRosterTbody = document.getElementById('master-roster-tbody') as HTMLTableSectionElement;
const metricPerformers = document.getElementById('metric-performers') as HTMLSpanElement;
const metricSpectators = document.getElementById('metric-spectators') as HTMLSpanElement;
const metricTdFps = document.getElementById('metric-td-fps') as HTMLSpanElement;
const metricTdErrors = document.getElementById('metric-td-errors') as HTMLSpanElement;

// Sliders: s1-s4 (DOM Pool)
const sliderS1 = document.getElementById('slider-s1') as HTMLInputElement;
const sliderS1Readout = document.getElementById('slider-s1-readout') as HTMLSpanElement;
const sliderS2 = document.getElementById('slider-s2') as HTMLInputElement;
const sliderS2Readout = document.getElementById('slider-s2-readout') as HTMLSpanElement;
const sliderS3 = document.getElementById('slider-s3') as HTMLInputElement;
const sliderS3Readout = document.getElementById('slider-s3-readout') as HTMLSpanElement;
const sliderS4 = document.getElementById('slider-s4') as HTMLInputElement;
const sliderS4Readout = document.getElementById('slider-s4-readout') as HTMLSpanElement;

// Joystick Elements
const joystickBoundary = document.getElementById('joystick-boundary') as HTMLDivElement;
const joystickPuck = document.getElementById('joystick-puck') as HTMLDivElement;
const puckCenterDot = document.getElementById('puck-center-dot') as HTMLDivElement;
const vectorCanvas = document.getElementById('vector-canvas') as HTMLCanvasElement;
const vctx = vectorCanvas ? vectorCanvas.getContext('2d') : null;

// Views
const viewPerformer = document.getElementById('view-performer') as HTMLDivElement;
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

const hostname = window.location.hostname;
const protocol = window.location.protocol;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname.startsWith('192.168') || hostname.startsWith('10.');
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrlBase = isLocal ? `ws://${hostname || '127.0.0.1'}:8080` : `${wsProtocol}//${window.location.host}`;
const httpUrlBase = isLocal ? `http://${hostname || '127.0.0.1'}:8080` : `${protocol}//${window.location.host}`;

const urlParams = new URLSearchParams(window.location.search);
const initialRoom = (urlParams.get('room') || "").trim().toUpperCase();
const initialKey = (urlParams.get('master_key') || urlParams.get('key') || "").trim().toUpperCase();

if (initialRoom.length === 4) {
    for (let i = 0; i < 4; i++) {
        if (codeBoxes[i]) codeBoxes[i].value = initialRoom[i];
    }
    if (roomCodeHidden) roomCodeHidden.value = initialRoom;
    if (masterRoomInput) masterRoomInput.value = initialRoom;
}

if (initialKey) {
    if (masterKeyInput) masterKeyInput.value = initialKey;
    try {
        const cleanUrl = window.location.pathname + (initialRoom ? `?room=${initialRoom}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}

    // Auto-launch master console
    if (initialRoom.length === 4) {
        setTimeout(executeMasterAuth, 150);
    } else {
        fetch(`${httpUrlBase}/health`)
            .then(res => res.json())
            .then(data => {
                if (data.room && data.room.length === 4) {
                    if (masterRoomInput) masterRoomInput.value = data.room;
                    setTimeout(executeMasterAuth, 150);
                }
            })
            .catch(() => {});
    }
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
    if (masterRoomInput && !masterRoomInput.value) masterRoomInput.value = code;
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

// Binary Pathway Selection in Gate ([01 // PERFORMER] vs [02 // SPECTATOR])
const gateRoleBtns = document.querySelectorAll('.role-select-btn');
const selectedRoleName = document.getElementById('selected-role-name');

gateRoleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        gateRoleBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const role = btn.getAttribute('data-role');
        currentRole = (role === 'audience' || role === 'spectator') ? 'audience' : 'performer';
        if (selectedRoleName) selectedRoleName.innerText = currentRole.toUpperCase();
        if (swatchSection) {
            swatchSection.style.display = currentRole === 'performer' ? 'block' : 'none';
        }
    });
});

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
// 2. FOH OPERATOR AUTHENTICATION MODAL LOGIC
// ============================================================================

if (openMasterModalBtn) {
    openMasterModalBtn.addEventListener('click', () => {
        const currentRoom = updateRoomCodeValue();
        if (masterRoomInput && currentRoom) masterRoomInput.value = currentRoom;
        if (masterErrorMsg) masterErrorMsg.style.display = 'none';
        masterAuthModal.style.display = 'flex';
        masterKeyInput.focus();
    });
}

if (masterAuthCancelBtn) {
    masterAuthCancelBtn.addEventListener('click', () => {
        masterAuthModal.style.display = 'none';
        if (masterKeyInput) masterKeyInput.value = '';
    });
}

if (masterAuthSubmitBtn) {
    masterAuthSubmitBtn.addEventListener('click', executeMasterAuth);
}

if (masterKeyInput) {
    masterKeyInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') executeMasterAuth();
    });
}

function showMasterError(msg: string) {
    if (masterErrorMsg) {
        masterErrorMsg.innerText = `[!] ${msg}`;
        masterErrorMsg.style.display = 'block';
    }
}

function executeMasterAuth() {
    const room = (masterRoomInput?.value || '').trim().toUpperCase();
    const key = (masterKeyInput?.value || '').trim().toUpperCase();

    if (room.length !== 4) {
        showMasterError("PLEASE ENTER 4-CHARACTER ROOM CODE");
        return;
    }
    if (!key) {
        showMasterError("PLEASE ENTER MASTER KEY");
        return;
    }

    if (masterErrorMsg) masterErrorMsg.style.display = 'none';

    // If socket is already open, send master_login
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'master_login', room, key }));
        return;
    }

    // Connect WS and send master_login on open
    ws = new WebSocket(wsUrlBase);
    attachWebSocketHandlers();

    ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'master_login', room, key }));
        startPingLoop();
    };
}

// ============================================================================
// 3. GENERAL ATTENDEE ONBOARDING & CONNECTION
// ============================================================================

joinBtn.addEventListener('click', () => {
    reconnectAttempts = 0;
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

    if (currentRole === 'performer') {
        if (viewPerformer) viewPerformer.style.display = 'flex';
        if (viewAudience) viewAudience.style.display = 'none';
        resizeCanvas();
    } else {
        if (viewPerformer) viewPerformer.style.display = 'none';
        if (viewAudience) viewAudience.style.display = 'flex';
    }

    connectWS(room);
});

exitBtn.addEventListener('click', disconnectSession);
if (masterExitBtn) masterExitBtn.addEventListener('click', disconnectSession);

function disconnectSession() {
    reconnectAttempts = 0;
    masterSessionToken = null;
    try { sessionStorage.removeItem('tdbridge_master_token'); } catch (e) {}
    flushInputs();
    if (ws) ws.close(1000, 'User disconnect');
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (pingIntervalTimer) {
        clearInterval(pingIntervalTimer);
        pingIntervalTimer = null;
    }
    ui.style.display = 'none';
    if (masterUi) masterUi.style.display = 'none';
    gate.style.display = 'flex';
    currentSlot = -1;
}

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
    attachWebSocketHandlers();

    ws.onopen = () => {
        reconnectAttempts = 0;
        slotIndicator.innerText = "LINKING...";
        ws?.send(JSON.stringify({
            type: 'join',
            name: playerName,
            room: roomCode,
            role: currentRole,
            color_hex: selectedColorHex,
            color_name: selectedColorName
        }));

        startPingLoop();
    };
}

function attachWebSocketHandlers() {
    if (!ws) return;

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Master Login Responses
            if (data.type === 'master_login_fail') {
                showMasterError(data.reason || 'Authentication Failed');
                return;
            }

            if (data.type === 'master_login_success') {
                masterSessionToken = data.token;
                try { sessionStorage.setItem('tdbridge_master_token', data.token); } catch(e) {}
                masterAuthModal.style.display = 'none';
                gate.style.display = 'none';
                ui.style.display = 'none';
                if (masterUi) masterUi.style.display = 'flex';
                if (data.active_scene) updateSceneControlsRack(data.active_scene);
                if (data.env_states) hydrateMasterEnvSliders(data.env_states);
                return;
            }

            // Live Performer Roster Update (Streamed to Master Console)
            if (data.type === 'roster_update') {
                handleRosterUpdate(data);
                return;
            }

            // Scene Switched Broadcast (from TouchDesigner or Master)
            if (data.type === 'scene_switched') {
                const sc = data.scene || 'aquarium';
                const prof = data.profile || 'gamepad';
                updateSceneControlsRack(sc);
                if (Array.isArray(data.ui_blueprint)) {
                    renderBlueprint(data.ui_blueprint);
                }
                document.querySelectorAll('.scene-btn').forEach(btn => {
                    if (btn.getAttribute('data-scene') === sc) {
                        btn.classList.add('is-active');
                    } else {
                        btn.classList.remove('is-active');
                    }
                });
                document.querySelectorAll('.profile-btn').forEach(btn => {
                    if (btn.getAttribute('data-profile') === prof) {
                        btn.classList.add('is-active');
                    } else {
                        btn.classList.remove('is-active');
                    }
                });
                return;
            }

            // Profile Change Broadcast
            if (data.type === 'profile_change') {
                const prof = data.profile || 'gamepad';
                if (Array.isArray(data.ui_blueprint)) {
                    renderBlueprint(data.ui_blueprint);
                }
                document.querySelectorAll('.profile-btn').forEach(btn => {
                    if (btn.getAttribute('data-profile') === prof) {
                        btn.classList.add('is-active');
                    } else {
                        btn.classList.remove('is-active');
                    }
                });
                return;
            }

            // General Attendee Handshakes
            if (data.type === 'assigned_slot') {
                reconnectAttempts = 0;
                currentSlot = data.slot;
                slotIndicator.innerText = `SLOT #${String(currentSlot).padStart(2, '0')}`;
                if (Array.isArray(data.ui_blueprint)) {
                    renderBlueprint(data.ui_blueprint);
                }
                startInputLoop();
            } else if (data.type === 'audience_joined') {
                reconnectAttempts = 0;
                slotIndicator.innerText = `SPECTATOR`;
            } else if (data.type === 'pong') {
                handlePong(data);
            } else if (data.type === 'kicked') {
                showError(`SESSION TERMINATED: ${data.reason || 'Disconnected by operator'}`);
                disconnectSession();
                return;
            } else if (data.type === 'rejected') {
                const reason = data.reason || 'REJECTED';
                showError(`JOIN REJECTED: ${reason}`);
                disconnectSession();
                return;
            } else if (data.type === 'error') {
                showError(data.message || 'CONNECTION ERROR');
                return;
            }
        } catch (e) {}
    };

    ws.onclose = (event: CloseEvent) => {
        if (pingIntervalTimer) {
            clearInterval(pingIntervalTimer);
            pingIntervalTimer = null;
        }

        // Clean exit or explicit rejections
        if (event.code === 1000 || event.code === 4001 || event.code === 4002 || event.code === 4003) {
            slotIndicator.innerText = "OFFLINE";
            showError(`DISCONNECTED (${event.code}): ${event.reason || 'Session ended'}`);
            disconnectSession();
            return;
        }

        // Auto-reconnect for unexpected drops
        if (ui.style.display === 'flex' || (masterUi && masterUi.style.display === 'flex')) {
            slotIndicator.innerText = "DISCONNECTED";
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const backoffMs = Math.min(8000, 1000 * Math.pow(2, reconnectAttempts - 1));
                if (rttStatus) {
                    rttStatus.innerText = `LINK: DROPPED // RETRY ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} IN ${backoffMs/1000}s`;
                    rttStatus.className = "hud-tag crimson";
                }
                const room = updateRoomCodeValue();
                reconnectTimer = setTimeout(() => connectWS(room), backoffMs);
            } else {
                showError("CONNECTION LOST: Server unreachable after 5 attempts");
                disconnectSession();
            }
        }
    };
}

// ============================================================================
// 4. REAL RTT PING PROTOCOL
// ============================================================================

function startPingLoop() {
    if (pingIntervalTimer) clearInterval(pingIntervalTimer);
    pingIntervalTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            lastPingSentTime = performance.now();
            ws.send(JSON.stringify({ type: 'ping', t: Date.now(), rtt: currentRtt }));
        }
    }, 2000);
}

function handlePong(data: any) {
    if (lastPingSentTime > 0) {
        currentRtt = Math.round(performance.now() - lastPingSentTime);
        const rttStr = `RTT: ${currentRtt}ms // LINKED`;
        if (rttStatus) {
            rttStatus.innerText = rttStr;
            rttStatus.className = currentRtt < 50 ? "hud-tag green" : (currentRtt < 150 ? "hud-tag cyan" : "hud-tag amber");
        }
        if (gateTelemetry) {
            gateTelemetry.innerText = `LINK READY // RTT: ${currentRtt}ms`;
        }
        if (masterRttStatus) {
            masterRttStatus.innerText = `RTT: ${currentRtt}ms`;
        }
    }
}

// ============================================================================
// 5. MASTER ROSTER SYNCHRONIZATION & ACTIONS
// ============================================================================

function handleRosterUpdate(data: any) {
    if (!masterUi || masterUi.style.display === 'none') return;

    if (rosterCountBadge) {
        rosterCountBadge.innerText = `${data.performers?.length || 0} ACTIVE`;
    }
    if (metricPerformers) {
        metricPerformers.innerText = `${data.performers?.length || 0} / 95`;
    }
    if (metricSpectators) {
        metricSpectators.innerText = String(data.spectator_count || 0);
    }
    if (metricTdFps) {
        metricTdFps.innerText = String(data.td_fps || '0.0');
    }
    if (masterTdStatus) {
        masterTdStatus.innerText = data.td_connected 
            ? `[ONLINE // ${data.td_fps || '60.0'} FPS]` 
            : `[OFFLINE // LINK DOWN]`;
        masterTdStatus.className = data.td_connected ? "hud-tag green" : "hud-tag crimson";
    }

    // Sync Scene Health status tag
    const masterSceneHealth = document.getElementById('master-scene-health');
    if (masterSceneHealth && data.scene_health) {
        masterSceneHealth.innerText = String(data.scene_health);
        masterSceneHealth.className = String(data.scene_health).includes('REPAIRED') || String(data.scene_health).includes('WARNING') 
            ? "hud-tag amber" 
            : "hud-tag cyan";
    }

    // Dynamic Scene Buttons
    const sceneButtonsContainer = document.getElementById('master-scene-buttons');
    if (sceneButtonsContainer && Array.isArray(data.available_scenes) && data.available_scenes.length > 0) {
        const existingScenes = Array.from(sceneButtonsContainer.querySelectorAll('.scene-btn')).map(b => b.getAttribute('data-scene'));
        const newScenes = data.available_scenes.map((s: any) => s.id);
        const isDifferent = existingScenes.length !== newScenes.length || existingScenes.some((id, idx) => id !== newScenes[idx]);

        if (isDifferent) {
            sceneButtonsContainer.textContent = '';
            data.available_scenes.forEach((sc: any) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `scene-btn ${sc.id === data.active_scene ? 'is-active' : ''}`;
                btn.setAttribute('data-scene', sc.id);
                btn.textContent = sc.label || sc.id.toUpperCase();
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');
                    sendHostCommand('scene_switch', { scene: sc.id });
                });
                sceneButtonsContainer.appendChild(btn);
            });
        }
    }

    // Sync Active Scene and Profile buttons
    if (data.active_scene) {
        document.querySelectorAll('.scene-btn').forEach(btn => {
            if (btn.getAttribute('data-scene') === data.active_scene) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    }
    if (data.current_profile) {
        document.querySelectorAll('.profile-btn').forEach(btn => {
            if (btn.getAttribute('data-profile') === data.current_profile) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    }

    // Build Roster Table strictly using textContent & DOM Elements (Zero innerHTML)
    if (masterRosterTbody && Array.isArray(data.performers)) {
        masterRosterTbody.textContent = ''; // Safe wipe of child nodes

        if (data.performers.length === 0) {
            const emptyTr = document.createElement('tr');
            const emptyTd = document.createElement('td');
            emptyTd.colSpan = 6;
            emptyTd.textContent = 'NO ACTIVE PERFORMERS (ROOM STANDING BY)';
            emptyTd.style.textAlign = 'center';
            emptyTd.style.color = 'var(--text-dim)';
            emptyTr.appendChild(emptyTd);
            masterRosterTbody.appendChild(emptyTr);
            return;
        }

        data.performers.forEach((p: any) => {
            const tr = document.createElement('tr');

            // Slot column
            const tdSlot = document.createElement('td');
            tdSlot.textContent = `#${String(p.slot).padStart(2, '0')}`;
            tr.appendChild(tdSlot);

            // Name column
            const tdName = document.createElement('td');
            tdName.textContent = String(p.name || 'UNKNOWN');
            tr.appendChild(tdName);

            // Palette swatch column
            const tdColor = document.createElement('td');
            const dot = document.createElement('span');
            dot.className = 'slot-dot-inline';
            dot.style.backgroundColor = p.color || '#ffffff';
            tdColor.appendChild(dot);
            const colorText = document.createTextNode(p.color || '#ffffff');
            tdColor.appendChild(colorText);
            tr.appendChild(tdColor);

            // RTT column
            const tdRtt = document.createElement('td');
            tdRtt.textContent = `${p.rtt || 0}ms`;
            tr.appendChild(tdRtt);

            // Uptime column
            const tdUptime = document.createElement('td');
            tdUptime.textContent = `${p.connected_seconds || 0}s`;
            tr.appendChild(tdUptime);

            // Kick action column
            const tdAction = document.createElement('td');
            const kickBtn = document.createElement('button');
            kickBtn.type = 'button';
            kickBtn.className = 'kick-text-btn';
            kickBtn.textContent = 'DISCONNECT';
            kickBtn.onclick = () => {
                sendHostCommand('kick_slot', { slot: p.slot });
            };
            tdAction.appendChild(kickBtn);
            tr.appendChild(tdAction);

            masterRosterTbody.appendChild(tr);
        });
    }
}

// Master Scene Switcher
const sceneButtons = document.querySelectorAll('.scene-btn');
sceneButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        sceneButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const sc = btn.getAttribute('data-scene') || 'aquarium';
        updateSceneControlsRack(sc);
        sendHostCommand('scene_switch', { scene: sc });
    });
});

// Master Profile Switcher
const profileButtons = document.querySelectorAll('.profile-btn');
profileButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        profileButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const prof = btn.getAttribute('data-profile') || 'gamepad';
        sendHostCommand('change_profile', { profile: prof });
    });
});

// Master Emergency Cues
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
    if (ws && ws.readyState === WebSocket.OPEN && masterSessionToken) {
        ws.send(JSON.stringify({
            type: 'host_command',
            action,
            token: masterSessionToken,
            ...extra
        }));
    }
}

// ============================================================================
// 5B. FOH MASTER SCENE PARAMETERS RACK & ENVIRONMENT CONTROLS
// ============================================================================

function updateSceneControlsRack(scene: string) {
    const sc = (scene || 'aquarium').toLowerCase();
    const aquariumRack = document.getElementById('scene-controls-aquarium');
    const canvasRack = document.getElementById('scene-controls-canvas');
    const qrRack = document.getElementById('scene-controls-qr');
    const dynamicRack = document.getElementById('scene-controls-dynamic');
    const badge = document.getElementById('master-active-scene-badge');

    const isBuiltin = (sc === 'aquarium' || sc === 'canvas' || sc === 'qr');

    if (aquariumRack) aquariumRack.style.display = (sc === 'aquarium') ? 'block' : 'none';
    if (canvasRack) canvasRack.style.display = (sc === 'canvas') ? 'block' : 'none';
    if (qrRack) qrRack.style.display = (sc === 'qr') ? 'block' : 'none';
    if (dynamicRack) {
        dynamicRack.style.display = !isBuiltin ? 'block' : 'none';
        if (!isBuiltin) {
            renderDynamicSceneRack(sc);
        }
    }

    if (badge) {
        badge.textContent = sc.toUpperCase();
        if (sc === 'aquarium') badge.className = 'hud-tag green';
        else if (sc === 'canvas') badge.className = 'hud-tag cyan';
        else if (sc === 'qr') badge.className = 'hud-tag yellow';
        else badge.className = 'hud-tag white';
    }
}

function renderDynamicSceneRack(scene: string) {
    const actionsContainer = document.getElementById('dynamic-rack-actions');
    const slidersContainer = document.getElementById('dynamic-rack-sliders');
    if (!actionsContainer || !slidersContainer) return;

    actionsContainer.textContent = '';
    slidersContainer.textContent = '';

    // Action 1: Trigger Pulse
    const pulseBtn = document.createElement('button');
    pulseBtn.type = 'button';
    pulseBtn.className = 'mono-btn rack-action-btn';
    const pTitle = document.createElement('span');
    pTitle.className = 'rack-btn-title';
    pTitle.textContent = 'TRIGGER PULSE';
    const pSub = document.createElement('span');
    pSub.className = 'rack-btn-sub';
    pSub.textContent = 'EXECUTE EVENT';
    pulseBtn.appendChild(pTitle);
    pulseBtn.appendChild(pSub);
    pulseBtn.addEventListener('click', () => {
        sendEnv(`${scene}_pulse`, 1);
        safeHaptic();
    });
    actionsContainer.appendChild(pulseBtn);

    // Action 2: Reset State
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'mono-btn rack-action-btn';
    const rTitle = document.createElement('span');
    rTitle.className = 'rack-btn-title';
    rTitle.textContent = 'RESET STATE';
    const rSub = document.createElement('span');
    rSub.className = 'rack-btn-sub';
    rSub.textContent = 'RESTORE DEFAULT';
    resetBtn.appendChild(rTitle);
    resetBtn.appendChild(rSub);
    resetBtn.addEventListener('click', () => {
        sendEnv(`${scene}_reset`, 1);
        safeHaptic();
    });
    actionsContainer.appendChild(resetBtn);

    // Dynamic Sliders: Speed, Intensity, Scale
    const defaultSliders = [
        { id: `${scene}_speed`, label: 'GENERATIVE SPEED', min: 0.1, max: 2.0, step: 0.05, def: 1.0, unit: 'x' },
        { id: `${scene}_intensity`, label: 'EFFECT INTENSITY', min: 0.0, max: 1.0, step: 0.01, def: 0.8, unit: '%' },
        { id: `${scene}_scale`, label: 'GEOMETRY SCALE', min: 0.5, max: 2.5, step: 0.05, def: 1.0, unit: 'x' }
    ];

    defaultSliders.forEach(s => {
        const mod = document.createElement('div');
        mod.className = 'slider-module rack-slider';

        const header = document.createElement('div');
        header.className = 'slider-header';

        const title = document.createElement('span');
        title.className = 'slider-title';
        title.textContent = s.label;

        const valSpan = document.createElement('span');
        valSpan.className = 'slider-val';
        valSpan.textContent = s.unit === '%' ? `${Math.round(s.def * 100)}%` : `${s.def.toFixed(2)}${s.unit}`;

        header.appendChild(title);
        header.appendChild(valSpan);
        mod.appendChild(header);

        const wrap = document.createElement('div');
        wrap.className = 'slider-track-wrap';

        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'mono-range';
        input.min = String(s.min);
        input.max = String(s.max);
        input.step = String(s.step);
        input.value = String(s.def);

        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            valSpan.textContent = s.unit === '%' ? `${Math.round(v * 100)}%` : `${v.toFixed(2)}${s.unit}`;
            sendThrottledEnv(s.id, v);
        });

        wrap.appendChild(input);
        mod.appendChild(wrap);
        slidersContainer.appendChild(mod);
    });
}

function sendEnv(param: string, value: number) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!masterSessionToken) return;
    ws.send(JSON.stringify({
        type: 'env',
        param,
        value,
        token: masterSessionToken
    }));
}

let lastEnvSliderSend = 0;
let pendingEnvTimeout: any = null;

function sendThrottledEnv(param: string, value: number) {
    const now = performance.now();
    if (now - lastEnvSliderSend >= 33) { // ~30Hz
        lastEnvSliderSend = now;
        sendEnv(param, value);
    } else {
        if (pendingEnvTimeout) clearTimeout(pendingEnvTimeout);
        pendingEnvTimeout = setTimeout(() => {
            lastEnvSliderSend = performance.now();
            sendEnv(param, value);
        }, 33);
    }
}

function hydrateMasterEnvSliders(env: Record<string, number>) {
    if (!env) return;
    if (typeof env.num_bots === 'number') {
        const el = document.getElementById('rack-slider-bots') as HTMLInputElement;
        const val = document.getElementById('rack-bots-val');
        if (el) el.value = String(env.num_bots);
        if (val) val.textContent = `${env.num_bots} BOTS`;
    }
    if (typeof env.bot_speed === 'number') {
        const el = document.getElementById('rack-slider-speed') as HTMLInputElement;
        const val = document.getElementById('rack-speed-val');
        if (el) el.value = String(env.bot_speed);
        if (val) val.textContent = Number(env.bot_speed).toFixed(2);
    }
    if (typeof env.bot_scale === 'number') {
        const el = document.getElementById('rack-slider-scale') as HTMLInputElement;
        const val = document.getElementById('rack-scale-val');
        if (el) el.value = String(env.bot_scale);
        if (val) val.textContent = `${Number(env.bot_scale).toFixed(2)}x`;
    }
    if (typeof env.canvas_trail === 'number') {
        const el = document.getElementById('rack-slider-trail') as HTMLInputElement;
        const val = document.getElementById('rack-trail-val');
        if (el) el.value = String(env.canvas_trail);
        if (val) val.textContent = `${Math.round(Number(env.canvas_trail) * 100)}%`;
    }
    if (typeof env.canvas_speed === 'number') {
        const el = document.getElementById('rack-slider-turb') as HTMLInputElement;
        const val = document.getElementById('rack-turb-val');
        if (el) el.value = String(env.canvas_speed);
        if (val) val.textContent = `${Number(env.canvas_speed).toFixed(2)}x`;
    }
}

// Master Environment Rack Button Listeners
const rackScareBtn = document.getElementById('rack-btn-scare');
if (rackScareBtn) {
    rackScareBtn.addEventListener('click', () => {
        sendEnv('scare', 1);
        safeHaptic();
    });
}
const rackFeedBtn = document.getElementById('rack-btn-feed');
if (rackFeedBtn) {
    rackFeedBtn.addEventListener('click', () => {
        sendEnv('drop_food', 1);
        safeHaptic();
    });
}
const rackBurstBtn = document.getElementById('rack-btn-burst');
if (rackBurstBtn) {
    rackBurstBtn.addEventListener('click', () => {
        sendEnv('canvas_burst', 1);
        safeHaptic();
    });
}
const rackPaletteBtn = document.getElementById('rack-btn-palette');
if (rackPaletteBtn) {
    rackPaletteBtn.addEventListener('click', () => {
        sendEnv('canvas_color', 1);
        safeHaptic();
    });
}

// Master Environment Rack Slider Listeners (30Hz Throttled)
const rackSliderBots = document.getElementById('rack-slider-bots') as HTMLInputElement;
const rackBotsVal = document.getElementById('rack-bots-val');
if (rackSliderBots) {
    rackSliderBots.addEventListener('input', () => {
        const val = parseInt(rackSliderBots.value, 10);
        if (rackBotsVal) rackBotsVal.textContent = `${val} BOTS`;
        sendThrottledEnv('num_bots', val);
    });
}

const rackSliderSpeed = document.getElementById('rack-slider-speed') as HTMLInputElement;
const rackSpeedVal = document.getElementById('rack-speed-val');
if (rackSliderSpeed) {
    rackSliderSpeed.addEventListener('input', () => {
        const val = parseFloat(rackSliderSpeed.value);
        if (rackSpeedVal) rackSpeedVal.textContent = val.toFixed(2);
        sendThrottledEnv('bot_speed', val);
    });
}

const rackSliderScale = document.getElementById('rack-slider-scale') as HTMLInputElement;
const rackScaleVal = document.getElementById('rack-scale-val');
if (rackSliderScale) {
    rackSliderScale.addEventListener('input', () => {
        const val = parseFloat(rackSliderScale.value);
        if (rackScaleVal) rackScaleVal.textContent = `${val.toFixed(2)}x`;
        sendThrottledEnv('bot_scale', val);
    });
}

const rackSliderTrail = document.getElementById('rack-slider-trail') as HTMLInputElement;
const rackTrailVal = document.getElementById('rack-trail-val');
if (rackSliderTrail) {
    rackSliderTrail.addEventListener('input', () => {
        const val = parseFloat(rackSliderTrail.value);
        if (rackTrailVal) rackTrailVal.textContent = `${Math.round(val * 100)}%`;
        sendThrottledEnv('canvas_trail', val);
    });
}

const rackSliderTurb = document.getElementById('rack-slider-turb') as HTMLInputElement;
const rackTurbVal = document.getElementById('rack-turb-val');
if (rackSliderTurb) {
    rackSliderTurb.addEventListener('input', () => {
        const val = parseFloat(rackSliderTurb.value);
        if (rackTurbVal) rackTurbVal.textContent = `${val.toFixed(2)}x`;
        sendThrottledEnv('canvas_speed', val);
    });
}

// ============================================================================
// 6. JOYSTICK ERGONOMICS & POINTER CAPTURE
// ============================================================================

let isDraggingJoy: boolean = false;
let joyActivePointerId: number | null = null;
let joyBounds: DOMRect | null = null;
const trailBuffer: Array<{ x: number; y: number }> = [];

function updateJoyBounds() {
    if (joystickBoundary) joyBounds = joystickBoundary.getBoundingClientRect();
}

function resizeCanvas() {
    if (!vectorCanvas || !joystickBoundary) return;
    updateJoyBounds();
    if (joyBounds) {
        vectorCanvas.width = joyBounds.width;
        vectorCanvas.height = joyBounds.height;
    }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));

if (joystickBoundary) {
    joystickBoundary.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        isDraggingJoy = true;
        joyActivePointerId = e.pointerId;
        try { joystickBoundary.setPointerCapture(e.pointerId); } catch (err) {}
        updateJoyBounds();
        handleJoyMove(e);
        safeHaptic();
    });

    joystickBoundary.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isDraggingJoy || e.pointerId !== joyActivePointerId) return;
        e.preventDefault();
        handleJoyMove(e);
    });

    const resetJoy = (e: PointerEvent) => {
        if (e.pointerId !== joyActivePointerId && joyActivePointerId !== null) return;
        isDraggingJoy = false;
        joyActivePointerId = null;
        try { joystickBoundary.releasePointerCapture(e.pointerId); } catch (err) {}
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
// 7. TOUCHDESIGNER ACTIONS, DUAL SLIDERS & DYNAMIC BLUEPRINTS
// ============================================================================

interface ControlItem {
    type: 'button' | 'slider' | 'dpad' | 'toggle' | 'reaction';
    id: string;
    alias?: string;
    label: string;
    color?: string;
    default_val?: number;
    min?: number;
    max?: number;
    step?: number;
    badge?: string;
}

function resetAllControlInputs() {
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`btn-b${i}`);
        if (btn && btn.classList.contains('is-active')) {
            btn.classList.remove('is-active');
            const id = btn.getAttribute('data-id') || `b${i}`;
            sendControl(id, 0);
        }
    }
}

function renderBlueprint(blueprint: ControlItem[]) {
    if (!Array.isArray(blueprint) || blueprint.length === 0) return;

    // 1. Release active inputs before modifying controls
    resetAllControlInputs();

    // 2. Partition blueprint items into buttons and sliders
    const buttonItems = blueprint.filter(item => item.type === 'button' || item.type === 'toggle');
    const sliderItems = blueprint.filter(item => item.type === 'slider');

    // 3. Update DOM Pool Buttons (#btn-b1 to #btn-b4)
    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`btn-b${i + 1}`);
        const titleEl = document.getElementById(`btn-title-b${i + 1}`);
        const subEl = document.getElementById(`btn-sub-b${i + 1}`);
        const item = buttonItems[i];

        if (btn) {
            if (item) {
                btn.style.display = 'flex';
                btn.setAttribute('data-id', item.id);
                if (titleEl) titleEl.textContent = item.label.toUpperCase();
                if (subEl) subEl.textContent = item.badge || `TRIGGER (${i + 1})`;
            } else {
                btn.style.display = 'none';
            }
        }
    }

    // 4. Update DOM Pool Sliders (#slider-s1 to #slider-s4)
    for (let i = 0; i < 4; i++) {
        const mod = document.getElementById(`slider-module-s${i + 1}`);
        const input = document.getElementById(`slider-s${i + 1}`) as HTMLInputElement;
        const titleEl = document.getElementById(`slider-title-s${i + 1}`);
        const readoutEl = document.getElementById(`slider-s${i + 1}-readout`);
        const item = sliderItems[i];

        if (mod && input) {
            if (item) {
                mod.style.display = 'block';
                mod.setAttribute('data-id', item.id);
                if (titleEl) titleEl.textContent = `${item.label.toUpperCase()} (${item.id})`;
                const minVal = item.min !== undefined ? Math.round(item.min * 100) : 0;
                const maxVal = item.max !== undefined ? Math.round(item.max * 100) : 100;
                const defaultVal = item.default_val !== undefined ? Math.round(item.default_val * 100) : 50;
                input.min = String(minVal);
                input.max = String(maxVal);
                input.value = String(defaultVal);
                if (readoutEl) readoutEl.textContent = `${defaultVal}%`;
            } else {
                mod.style.display = 'none';
            }
        }
    }
}

const actionButtons = document.querySelectorAll('.action-btn');
actionButtons.forEach(btn => {
    const press = (e: PointerEvent) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id') || 'b1';
        btn.classList.add('is-active');
        sendControl(id, 1);
        safeHaptic();
    };

    const release = (e: PointerEvent) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id') || 'b1';
        btn.classList.remove('is-active');
        sendControl(id, 0);
    };

    btn.addEventListener('pointerdown', press as any);
    btn.addEventListener('pointerup', release as any);
    btn.addEventListener('pointercancel', release as any);
});

function bindSliderModule(sliderInput: HTMLInputElement | null, readoutEl: HTMLSpanElement | null, fallbackId: string) {
    if (!sliderInput) return;
    sliderInput.addEventListener('input', () => {
        const val = Number(sliderInput.value);
        if (readoutEl) readoutEl.innerText = `${val}%`;
        const mod = sliderInput.closest('.slider-module');
        const id = (mod && mod.getAttribute('data-id')) ? mod.getAttribute('data-id')! : fallbackId;
        const min = Number(sliderInput.min) || 0;
        const max = Number(sliderInput.max) || 100;
        const norm = max > min ? (val - min) / (max - min) : val / 100;
        sendControl(id, norm);
    });
}

bindSliderModule(sliderS1, sliderS1Readout, 's1');
bindSliderModule(sliderS2, sliderS2Readout, 's2');
bindSliderModule(sliderS3, sliderS3Readout, 's3');
bindSliderModule(sliderS4, sliderS4Readout, 's4');

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

function flushInputs() {
    if (ws && ws.readyState === WebSocket.OPEN && currentSlot !== -1) {
        ws.send(JSON.stringify({ type: 'flush' }));
    }
}

// ============================================================================
// 8. AUDIENCE SPECTATOR HYPE (ZERO EMOJIS)
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
        const rx = tile.getAttribute('data-reaction') || 'ignite';
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'control', id: `rx_${rx}`, value: 1 }));
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'control', id: `rx_${rx}`, value: 0 }));
                }
            }, 60);
        }
        safeHaptic();
    });
});

// ============================================================================
// 9. DESKTOP KEYBOARD BINDINGS (WASD, 1-4, SPACE)
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
// 10. 60Hz THROTTLED INPUT TRANSMISSION LOOP
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
