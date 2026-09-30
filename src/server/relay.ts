import WebSocket from 'ws';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import * as readline from 'readline';
// @ts-ignore
import osc from 'osc';
// @ts-ignore
import qrcode from 'qrcode-terminal';
import { BUILTIN_PROFILES, sanitizeBlueprint, ControlItem } from './profiles';

const WS_PORT = 8080;
const OSC_PORT = 9000;
const MAX_USERS = 100;

// Mutex Lockfile & Stale PID Recovery
const PID_FILE = path.join(__dirname, '../.relay.pid');
try {
    if (fs.existsSync(PID_FILE)) {
        const oldPidStr = fs.readFileSync(PID_FILE, 'utf-8').trim();
        const oldPid = parseInt(oldPidStr, 10);
        if (!isNaN(oldPid) && oldPid > 0 && oldPid !== process.pid) {
            try {
                process.kill(oldPid, 0); // test if process is alive
                spawnSync('taskkill', ['/F', '/T', '/PID', String(oldPid)], { stdio: 'ignore' });
            } catch (e) {
                // Stale lockfile, process is dead
            }
        }
    }
    fs.writeFileSync(PID_FILE, String(process.pid));
} catch (e) {}

const app = express();
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, maxPayload: 1024 });

app.use(express.static(path.join(__dirname, '../public')));

// Dynamic branding & room info
app.get('/branding', (req, res) => {
    res.json({ 
        project_name: "TouchDesigner Bridge", 
        subtitle: "Modular Live Interaction Pipeline", 
        primary_color: "#1e88e5", 
        bg_color: "#121212" 
    });
});
app.get('/room', (req, res) => {
    res.json({ room: ACTIVE_ROOM_CODE });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), room: ACTIVE_ROOM_CODE });
});

// Unified Machine-Readable Telemetry API with Tunnel Security Guard
app.get('/telemetry', (req, res) => {
    const clientIp = req.socket.remoteAddress || '';
    const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
    const token = req.query.token || req.headers['x-master-token'];
    
    // Guard: public requests over tunnel require master token or active room code
    if (!isLocal && token !== 'MASTER_KEY' && token !== ACTIVE_ROOM_CODE) {
        res.status(401).json({ error: 'Unauthorized: Telemetry requires ?token=MASTER_KEY or ?token=' + ACTIVE_ROOM_CODE + ' over public network' });
        return;
    }

    const mem = process.memoryUsage();
    const isTdConnected = (Date.now() - tdLastSeen < 3500) && (tdLastSeen > 0);
    const activePerformers = slots.filter(s => s.ws !== null && s.isJoined && s.role === 'performer').length;

    res.json({
        system: {
            status: isTdConnected ? 'healthy' : 'degraded',
            uptime_seconds: Math.round(process.uptime()),
            pid: process.pid,
            memory_rss_mb: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
            active_profile: currentProfile,
            room_code: ACTIVE_ROOM_CODE
        },
        ports: {
            http_ws_port: WS_PORT,
            osc_remote_port: OSC_PORT,
            osc_local_port: 9001,
            is_listening: server.listening
        },
        touchdesigner: {
            is_connected: isTdConnected,
            cook_fps: parseFloat(tdFPS) || 0.0,
            last_heartbeat_ms_ago: tdLastSeen > 0 ? Date.now() - tdLastSeen : null,
            allocated_clones: tdClones,
            total_errors_count: tdErrors,
            last_error: lastErrorMsg || null,
            loopback_latency_ms: tdLoopbackLatency
        },
        network: {
            tunnel_status: cloudflareUrl ? 'live' : 'local_only',
            public_url: cloudflareUrl || `http://127.0.0.1:${WS_PORT}`,
            total_connected_sockets: slots.filter(s => s.ws !== null).length + audienceSockets.size,
            performers_active: activePerformers,
            audience_spectators: audienceSockets.size,
            average_client_rtt_ms: computeAverageRtt()
        },
        recent_events: eventLogRingBuffer.slice(-50)
    });
});

// Profile REST APIs
app.get('/profile', (req, res) => {
    res.json({
        current: currentProfile,
        profile_type: BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        profiles: Object.keys(BUILTIN_PROFILES),
        blueprint: activeBlueprint
    });
});

app.post('/profile/:name', (req, res) => {
    const target = req.params.name.toLowerCase();
    if (BUILTIN_PROFILES[target]) {
        setProfile(target);
        res.json({ success: true, profile: currentProfile });
    } else {
        res.status(404).json({ error: `Unknown profile: ${target}` });
    }
});

app.post('/profile/custom', (req, res) => {
    const sanitized = sanitizeBlueprint(req.body?.blueprint);
    if (sanitized.length > 0) {
        currentProfile = 'custom';
        activeBlueprint = sanitized;
        addLog(`[PROFILE] Installed custom blueprint via REST (${sanitized.length} controls)`);
        broadcastProfileChange();
        res.json({ success: true, count: sanitized.length });
    } else {
        res.status(400).json({ error: 'Invalid blueprint payload' });
    }
});

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRTUVWXY346789";
function generateRoomCode(): string {
    let res = "";
    for (let i = 0; i < 4; i++) {
        res += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return res;
}
const ACTIVE_ROOM_CODE = generateRoomCode();

// State
let activePlayers = 0;
let cloudflareUrl = "";
let tdFPS = "0.0";
let tdErrors = 0;
let lastErrorMsg = '';
let lastErrorTime = 0;
let tdLastSeen = 0;
let tdClones = 0;
let tdLoopbackLatency = 0;
let currentProfile = 'gamepad';
let activeBlueprint: ControlItem[] = BUILTIN_PROFILES.gamepad.blueprint;

// Client RTT Tracking
const clientRtts: Map<WebSocket, number> = new Map();
function computeAverageRtt(): number {
    if (clientRtts.size === 0) return 0;
    let sum = 0;
    for (const rtt of clientRtts.values()) sum += rtt;
    return Math.round((sum / clientRtts.size) * 10) / 10;
}

// 50-Item Event Log Ring Buffer
interface EventLogItem {
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DISCONNECT';
    message: string;
}
const eventLogRingBuffer: EventLogItem[] = [];
function recordEvent(level: 'INFO' | 'WARN' | 'ERROR' | 'DISCONNECT', message: string) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    eventLogRingBuffer.push({ timestamp, level, message });
    if (eventLogRingBuffer.length > 50) eventLogRingBuffer.shift();
}

const LOG_FILE_PATH = path.join(__dirname, '../scratch_debug/error_log.txt');
try {
    fs.mkdirSync(path.dirname(LOG_FILE_PATH), { recursive: true });
} catch (e) {}
const MAX_LOGS = 10;
const logs: string[] = [];

function addLog(msg: string) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const formattedMsg = `[${timestamp}] ${msg}`;
    const level: 'INFO' | 'WARN' | 'ERROR' | 'DISCONNECT' = 
        msg.includes('ERROR') || msg.includes('FATAL') ? 'ERROR' :
        msg.includes('DISCONNECT') || msg.includes('left') ? 'DISCONNECT' :
        msg.includes('WARN') || msg.includes('TIMEOUT') ? 'WARN' : 'INFO';
    recordEvent(level, msg);
    
    if (msg.includes('ERROR') || msg.includes('FATAL')) {
        const dateStamp = new Date().toLocaleDateString('en-US');
        fs.appendFile(LOG_FILE_PATH, `[${dateStamp} ${timestamp}] ${msg}\n`, (err) => {
            if (err) console.error("Failed to write to log file");
        });
    }

    logs.push(formattedMsg);
    if (logs.length > MAX_LOGS) logs.shift();
    requestRedraw();
}

// UI Redraw Debouncing
let redrawPending = false;
function requestRedraw() {
    if (!redrawPending) {
        redrawPending = true;
        setImmediate(() => {
            printDashboard();
            redrawPending = false;
        });
    }
}

function printDashboard() {
    if (process.stdout.isTTY) {
        try {
            readline.cursorTo(process.stdout, 0, 0);
            readline.clearScreenDown(process.stdout);
        } catch (e) {}
    }
    
    const isTdConnected = (Date.now() - tdLastSeen < 3500) && (tdLastSeen > 0);
    const tdStatusStr = isTdConnected ? `\x1b[32m[ONLINE - ${tdFPS} FPS]\x1b[0m` : `\x1b[33m[CONNECTING / WAITING...]\x1b[0m`;
    const netStatusStr = cloudflareUrl ? `\x1b[32m[LIVE - CLOUDFLARE]\x1b[0m` : `\x1b[33m[ESTABLISHING TUNNEL...]\x1b[0m`;

    console.log("=========================================================");
    console.log("             TOUCHDESIGNER BRIDGE TERMINAL               ");
    console.log("=========================================================");
    console.log(`[NETWORK]    Status:          ${netStatusStr}`);
    console.log(`[URL]        Public Address:  \x1b[36m${cloudflareUrl || 'http://127.0.0.1:' + WS_PORT}\x1b[0m`);
    console.log(`[LOCAL]      Local LAN:       http://127.0.0.1:${WS_PORT}`);
    console.log(`---------------------------------------------------------`);
    console.log(`[ROOM CODE]  \x1b[1m\x1b[33m>>>  [ ${ACTIVE_ROOM_CODE.split('').join(' ')} ]  <<<\x1b[0m   (Enter on mobile)`);
    console.log(`---------------------------------------------------------`);
    console.log(`[PROFILE]    Active Profile:  \x1b[35m${currentProfile.toUpperCase()}\x1b[0m  (${activeBlueprint.length} controls)`);
    console.log(`[ENGINE]     TouchDesigner:   ${tdStatusStr}  |  Errors: ${tdErrors}`);
    console.log(`[CLIENTS]    Connected Users: ${activePlayers} / ${MAX_USERS}  (Allocated Slots: ${tdClones})`);
    
    const activeNames = slots.filter(s => s.ws !== null && s.name && s.name !== "Connecting...").map(s => s.name);
    if (activeNames.length > 0) {
        console.log(`             Active Users:    \x1b[32m${activeNames.join(', ')}\x1b[0m`);
    }
    console.log("=========================================================");
    
    if (cloudflareUrl) {
        console.log("\nScan to join:");
        const fullUrl = `${cloudflareUrl}/?room=${ACTIVE_ROOM_CODE}`;
        qrcode.generate(fullUrl, { small: true });
        console.log("=========================================================\n");
    }
    console.log("Live Telemetry & Diagnostics:");
    if (logs.length === 0) {
        console.log("  (System standing by. Waiting for player joins...)");
    } else {
        logs.forEach(l => console.log(`  ${l}`));
    }
}

process.stdout.on('resize', requestRedraw);

// Set up OSC (Two-Way Telemetry & Profile Sync)
const udpPort = new osc.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 9001, 
    remoteAddress: "127.0.0.1",
    remotePort: OSC_PORT
});

udpPort.on("error", (err: Error) => {
    addLog(`[OSC ERROR] ${err.message}`);
});

udpPort.on("message", (oscMsg: any) => {
    try {
        tdLastSeen = Date.now();
        const val = oscMsg.args?.[0]?.value ?? oscMsg.args?.[0];
        
        if (oscMsg.address === "/td/fps") {
            const newFps = Number(val || 0).toFixed(1);
            if (newFps !== tdFPS) {
                tdFPS = newFps;
                requestRedraw();
            }
        } else if (oscMsg.address === "/td/clones") {
            tdClones = Number(val || 0);
        } else if (oscMsg.address === "/td/pong") {
            const t1 = Number(val || 0);
            if (t1 > 0) {
                tdLoopbackLatency = Math.max(0, Date.now() - t1);
            }
        } else if (oscMsg.address === "/td/error") {
            const rawMsg = String(val ?? '(unknown error)');
            if (!rawMsg || rawMsg === '' || rawMsg.includes('Cook dependency loop')) return;
            const now = Date.now();
            if (rawMsg === lastErrorMsg && now - lastErrorTime < 3000) return;
            lastErrorMsg = rawMsg;
            lastErrorTime = now;
            tdErrors++;
            addLog(`[TD ENGINE ERROR] ${rawMsg.substring(0, 80)}`);
        } else if (oscMsg.address === "/bridge/profile") {
            const requested = String(val || '').toLowerCase().trim();
            if (BUILTIN_PROFILES[requested]) {
                setProfile(requested);
            } else {
                addLog(`[PROFILE] Unknown profile requested via OSC: ${requested}`);
            }
        } else if (oscMsg.address === "/bridge/set_blueprint") {
            try {
                const rawJson = typeof val === 'string' ? JSON.parse(val) : val;
                const sanitized = sanitizeBlueprint(rawJson);
                if (sanitized.length > 0) {
                    currentProfile = 'custom';
                    activeBlueprint = sanitized;
                    addLog(`[PROFILE] Installed custom blueprint via OSC (${sanitized.length} controls)`);
                    broadcastProfileChange();
                }
            } catch (e: any) {
                addLog(`[PROFILE ERROR] Failed to parse custom blueprint: ${e.message}`);
            }
        }
    } catch (e) {}
});

udpPort.open();
udpPort.on("ready", () => {
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
});

function setProfile(profileName: string) {
    if (!BUILTIN_PROFILES[profileName]) return;
    currentProfile = profileName;
    activeBlueprint = BUILTIN_PROFILES[profileName].blueprint;
    addLog(`[PROFILE] Switched active profile to: ${currentProfile.toUpperCase()}`);
    broadcastProfileChange();
}

function broadcastProfileChange() {
    const payload = JSON.stringify({
        type: 'profile_change',
        profile: currentProfile,
        profile_type: BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        ui_blueprint: activeBlueprint
    });
    
    for (const slot of slots) {
        if (slot.ws && slot.ws.readyState === WebSocket.OPEN) {
            try {
                slot.ws.send(payload);
            } catch (e) {}
        }
    }
    requestRedraw();
}

// Run Cloudflare
const binPath = path.join(__dirname, '../bin/cloudflared.exe');
const rootPath = path.join(__dirname, '../cloudflared.exe');
const cfExecutable = fs.existsSync(binPath) ? binPath : rootPath;
const cf = spawn(cfExecutable, ['tunnel', '--url', `http://127.0.0.1:${WS_PORT}`]);
cf.stdout.on('data', () => {});
cf.stderr.on('data', (data) => {
    const output = data.toString();
    const match = output.match(/https:\/\/(.*\.trycloudflare\.com)/);
    if (match) {
        cloudflareUrl = "https://" + match[1];
        addLog(`[NETWORK] Tunnel established at ${cloudflareUrl}`);
        try {
            udpPort.send({ address: '/bridge/tunnel', args: [{ type: 's', value: cloudflareUrl }] }, "127.0.0.1", OSC_PORT);
        } catch (e) {}
        requestRedraw();
    }
});
cf.on('error', (err) => { addLog(`[FATAL] Failed to start cloudflared.exe: ${err.message}`); });
cf.on('close', (code) => { addLog(`[NETWORK] Tunnel exited (Code ${code})`); });


// Setup WebSockets
interface SlotData { 
    ws: WebSocket | null; 
    connectedAt: number;
    lastSeen: number; 
    lastMsg: number; 
    name: string; 
    isJoined: boolean;
    role: 'performer' | 'audience' | 'master';
}
const slots: SlotData[] = Array.from({ length: MAX_USERS }, () => ({ 
    ws: null, 
    connectedAt: 0,
    lastSeen: 0, 
    lastMsg: 0, 
    name: "", 
    isJoined: false,
    role: 'performer'
}));
const audienceSockets = new Set<WebSocket>();

// Slots 1-5 (indices 0-4) are reserved for background bot choir / demo agents
// Real players join in slots 6-100 (indices 5-99)
function getAvailableSlot(): number { 
    return slots.findIndex((s, idx) => idx >= 5 && s.ws === null); 
}
function updatePlayerCount() { activePlayers = slots.filter(s => s.ws !== null).length; requestRedraw(); }

function freeSlot(index: number) {
    if (index >= 0 && index < MAX_USERS && slots[index].ws !== null) {
        const name = slots[index].name;
        if (slots[index].ws) {
            clientRtts.delete(slots[index].ws as WebSocket);
        }
        slots[index].ws = null;
        slots[index].name = "";
        slots[index].isJoined = false;
        slots[index].connectedAt = 0;
        slots[index].lastSeen = 0;
        slots[index].lastMsg = 0;
        slots[index].role = 'performer';
        slotStates[index] = {};
        addLog(`[DISCONNECT] Slot ${index + 1} (${name || 'unknown'}) left.`);
        
        // Zero all channels
        sendOSC_Float(index + 1, "x", 0);
        sendOSC_Float(index + 1, "y", 0);
        sendOSC_Float(index + 1, "tx", 0);
        sendOSC_Float(index + 1, "ty", 0);
        sendOSC_Float(index + 1, "b1", 0);
        sendOSC_Float(index + 1, "b2", 0);
        sendOSC_Float(index + 1, "b3", 0);
        sendOSC_Float(index + 1, "b4", 0);
        sendOSC_Float(index + 1, "action1", 0);
        sendOSC_Float(index + 1, "action2", 0);
        sendOSC_Float(index + 1, "action3", 0);
        sendOSC_String(index + 1, "name", "");
        sendOSC_Float(index + 1, "active", 0);
        updatePlayerCount();
    }
}

function sendOSC_Float(slotNumber: number, channel: string, value: number) { 
    try { 
        udpPort.send({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "f", value: value }] }, "127.0.0.1", OSC_PORT); 
    } catch (e) { }
}
function sendOSC_String(slotNumber: number, channel: string, value: string) { 
    try { 
        udpPort.send({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "s", value: value }] }, "127.0.0.1", OSC_PORT); 
    } catch (e) { }
}

const slotStates: { [slot: number]: { [key: string]: any } } = {};

wss.on('connection', (ws: WebSocket) => {
    const slotIndex = getAvailableSlot();
    if (slotIndex === -1) { ws.send(JSON.stringify({ type: 'rejected' })); ws.close(); return; }
    
    const now = Date.now();
    slots[slotIndex] = { 
        ws: ws, 
        connectedAt: now, 
        lastSeen: now, 
        lastMsg: 0, 
        name: "Connecting...", 
        isJoined: false, 
        role: 'performer' 
    };
    slotStates[slotIndex] = {};
    const playerNum = slotIndex + 1; 
    
    // Handshake includes current profile & active blueprint for late-joiner sync
    ws.send(JSON.stringify({ 
        type: 'assigned_slot', 
        slot: playerNum,
        profile: currentProfile,
        profile_type: BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        ui_blueprint: activeBlueprint
    }));

    ws.on('error', (err) => { addLog(`[WS ERROR] Slot ${playerNum}: ${err.message}`); });

    ws.on('message', (message: WebSocket.Data) => {
        try {
            const now = Date.now();
            if (slotIndex !== -1 && slots[slotIndex] && slots[slotIndex].ws === ws) {
                if (now - slots[slotIndex].lastMsg < 15) return; // 60Hz limit
                slots[slotIndex].lastMsg = now;
                if (slots[slotIndex].isJoined) {
                    slots[slotIndex].lastSeen = now;
                }
            }
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') { 
                if (typeof data.rtt === 'number') {
                    clientRtts.set(ws, data.rtt);
                }
                ws.send(JSON.stringify({ type: 'pong', t: data.t })); 
                return; 
            }
            if (data.type === 'client_telemetry_error') {
                const cleanErr = String(data.message || 'Unknown Client Error').substring(0, 140);
                const clientRef = (slotIndex !== -1 && slots[slotIndex]?.name && slots[slotIndex]?.isJoined) 
                    ? `Slot ${playerNum} (${slots[slotIndex].name})` 
                    : (audienceSockets.has(ws) ? 'Audience' : 'Connecting');
                addLog(`[CLIENT ERROR] [${clientRef}] ${cleanErr} (line ${data.line || '?'}:${data.col || '?'})`);
                return;
            }
            if (data.type === 'host_command') {
                if (data.token !== 'MASTER_KEY' && data.token !== ACTIVE_ROOM_CODE) {
                    ws.send(JSON.stringify({ type: 'error', message: 'UNAUTHORIZED HOST ACTION' }));
                    return;
                }
                if (data.action === 'scene_switch') {
                    udpPort.send({ address: '/bridge/scene', args: [{ type: 's', value: String(data.scene) }] }, '127.0.0.1', OSC_PORT);
                    addLog(`[HOST] Switched scene to: ${data.scene}`);
                } else if (data.action === 'system_reset') {
                    udpPort.send({ address: '/bridge/reset', args: [{ type: 'i', value: 1 }] }, '127.0.0.1', OSC_PORT);
                    addLog(`[HOST] Triggered global scene reset.`);
                } else if (data.action === 'slot_purge') {
                    for (let i = 5; i < MAX_USERS; i++) {
                        if (slots[i] && slots[i].ws) {
                            slots[i].ws.close();
                        }
                    }
                    addLog(`[HOST] Purged all performer slots.`);
                }
                ws.send(JSON.stringify({ type: 'host_ack', action: data.action, status: 'ok' }));
                return;
            }
            if (data.type === 'env') {
                if (typeof data.param === 'string') {
                    const val = typeof data.value === 'number' ? data.value : (data.value ? 1 : 0);
                    udpPort.send({
                        address: `/env/${data.param}`,
                        args: [{ type: "f", value: val }]
                    }, "127.0.0.1", OSC_PORT);
                }
                return;
            }
            if (data.type === 'join') {
                if (data.room !== ACTIVE_ROOM_CODE) { 
                    addLog(`[AUTH] Rejected connection! Expected: ${ACTIVE_ROOM_CODE}, Got: ${data.room}`);
                    ws.send(JSON.stringify({ type: 'rejected', reason: 'Invalid or Expired QR Code!' })); 
                    ws.close(); 
                    return; 
                }

                if (data.role === 'audience') {
                    if (slotIndex !== -1 && slots[slotIndex]?.ws === ws) {
                        slots[slotIndex].ws = null;
                        slots[slotIndex].name = "";
                        slots[slotIndex].isJoined = false;
                        slotStates[slotIndex] = {};
                        updatePlayerCount();
                    }
                    audienceSockets.add(ws);
                    ws.send(JSON.stringify({ type: 'audience_joined' }));
                    addLog(`[CONNECT] Spectator joined as AUDIENCE (0 performer slots consumed)`);
                    return;
                }

                const cleanName = typeof data.name === 'string' ? data.name.substring(0, 12) : "Anonymous";
                if (slotIndex !== -1 && slots[slotIndex] && slots[slotIndex].ws === ws) {
                    slots[slotIndex].name = cleanName;
                    slots[slotIndex].isJoined = true;
                    slots[slotIndex].lastSeen = Date.now();
                    sendOSC_String(playerNum, "name", cleanName);
                    if (typeof data.color_hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.color_hex)) {
                        sendOSC_String(playerNum, "color", data.color_hex);
                    }
                    sendOSC_Float(playerNum, "active", 1);
                    addLog(`[CONNECT] Slot ${playerNum} registered as: ${cleanName}`);
                    updatePlayerCount();
                }
                return;
            }
            if (data.type === 'control') {
                if (slotIndex === -1 || !slots[slotIndex] || slots[slotIndex].ws !== ws) return;
                const value = typeof data.value === 'number' ? data.value : (data.value ? 1 : 0);
                const key = String(data.id);
                if (slotStates[slotIndex][key] !== value) {
                    slotStates[slotIndex][key] = value;
                    sendOSC_Float(playerNum, key, value);
                    
                    // Dual-channel mappings for full backward compatibility
                    if (key === 'b1') sendOSC_Float(playerNum, 'action1', value);
                    if (key === 'b2') sendOSC_Float(playerNum, 'action2', value);
                    if (key === 'b3') sendOSC_Float(playerNum, 'action3', value);
                    if (key === 'action1') sendOSC_Float(playerNum, 'b1', value);
                    if (key === 'action2') sendOSC_Float(playerNum, 'b2', value);
                    if (key === 'action3') sendOSC_Float(playerNum, 'b3', value);
                    if (key === 's1') sendOSC_Float(playerNum, 'slider1', value);
                    if (key === 's2') sendOSC_Float(playerNum, 'slider2', value);
                    if (key === 'slider1') sendOSC_Float(playerNum, 's1', value);
                    if (key === 'slider2') sendOSC_Float(playerNum, 's2', value);
                }
                return;
            }
            if (data.type === 'input') {
                if (slotIndex === -1 || !slots[slotIndex] || slots[slotIndex].ws !== ws) return;
                const parsedX = parseFloat(data.x); const parsedY = parseFloat(data.y);
                const x = isNaN(parsedX) ? 0 : Math.max(-1, Math.min(1, parsedX));
                const y = isNaN(parsedY) ? 0 : Math.max(-1, Math.min(1, parsedY));
                
                if (slotStates[slotIndex]['x'] !== x) {
                    slotStates[slotIndex]['x'] = x;
                    sendOSC_Float(playerNum, "x", x);
                    sendOSC_Float(playerNum, "tx", x);
                }
                if (slotStates[slotIndex]['y'] !== y) {
                    slotStates[slotIndex]['y'] = y;
                    sendOSC_Float(playerNum, "y", y);
                    sendOSC_Float(playerNum, "ty", y);
                }
                return;
            }
            if (data.type === 'tap') {
                const rate = typeof data.rate === 'number' ? data.rate : 0;
                if (audienceSockets.has(ws)) {
                    try {
                        udpPort.send({ address: '/bridge/hype', args: [{ type: "f", value: 1.0 }] }, "127.0.0.1", OSC_PORT);
                        udpPort.send({ address: '/audience/tap', args: [{ type: "f", value: rate }] }, "127.0.0.1", OSC_PORT);
                    } catch(e) {}
                } else if (slotIndex !== -1 && slots[slotIndex]?.ws === ws) {
                    sendOSC_Float(playerNum, "tap_rate", rate);
                    sendOSC_Float(playerNum, "b1", 1);
                    sendOSC_Float(playerNum, "action1", 1);
                    setTimeout(() => { 
                        sendOSC_Float(playerNum, "b1", 0); 
                        sendOSC_Float(playerNum, "action1", 0);
                    }, 50);
                }
                return;
            }
            if (data.type === 'flush') {
                if (slotIndex === -1 || !slots[slotIndex] || slots[slotIndex].ws !== ws) return;
                slotStates[slotIndex] = {};
                sendOSC_Float(playerNum, "x", 0);
                sendOSC_Float(playerNum, "y", 0);
                sendOSC_Float(playerNum, "tx", 0);
                sendOSC_Float(playerNum, "ty", 0);
                sendOSC_Float(playerNum, "b1", 0);
                sendOSC_Float(playerNum, "b2", 0);
                sendOSC_Float(playerNum, "b3", 0);
                sendOSC_Float(playerNum, "b4", 0);
                sendOSC_Float(playerNum, "action1", 0);
                sendOSC_Float(playerNum, "action2", 0);
                sendOSC_Float(playerNum, "action3", 0);
                return;
            }
        } catch (e) {}
    });
    ws.on('close', () => { 
        clientRtts.delete(ws);
        if (audienceSockets.has(ws)) {
            audienceSockets.delete(ws);
            addLog(`[DISCONNECT] Audience spectator left.`);
            return;
        }
        if (slotIndex !== -1 && slots[slotIndex]?.ws === ws) {
            freeSlot(slotIndex);
        }
    });
});

// Watchdog (8-second timeout for inactive joined players, 10-second deadline for unjoined connections)
setInterval(() => {
    const now = Date.now();
    for (let i = 0; i < MAX_USERS; i++) {
        const slot = slots[i];
        if (slot.ws !== null) {
            if (!slot.isJoined && now - slot.connectedAt > 10000) {
                addLog(`[TIMEOUT] Slot ${i + 1} unauthenticated >10s. Reaping slot.`);
                try { slot.ws?.terminate(); } catch(e) {}
                freeSlot(i);
            } else if (slot.isJoined && now - slot.lastSeen > 8000) {
                addLog(`[TIMEOUT] Slot ${i + 1} (${slot.name}) inactive >8s. Reaping slot.`);
                try { slot.ws?.terminate(); } catch(e) {}
                freeSlot(i);
            }
        }
    }
}, 2000);

// Deterministic 1000ms Heartbeat to TouchDesigner
setInterval(() => {
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
    if (cloudflareUrl) {
        try {
            udpPort.send({ address: '/bridge/tunnel', args: [{ type: 's', value: cloudflareUrl }] }, "127.0.0.1", OSC_PORT);
        } catch (e) {}
    }
}, 1000);

// Loopback ping to TouchDesigner (measures IPC / UDP latency)
setInterval(() => {
    try {
        udpPort.send({
            address: "/bridge/ping",
            args: [{ type: "f", value: Date.now() }]
        }, "127.0.0.1", OSC_PORT);
    } catch (e) {}
}, 2000);

// Resilient Graceful Shutdown & Child Process Tree Purge
let isShuttingDown = false;
function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    addLog(`[SYSTEM] Initiating clean shutdown (${signal})...`);

    // Hard fallback timeout (2000ms)
    const forceExitTimer = setTimeout(() => {
        try {
            if (fs.existsSync(PID_FILE)) {
                const currentPid = fs.readFileSync(PID_FILE, 'utf8').trim();
                if (currentPid === String(process.pid)) fs.unlinkSync(PID_FILE);
            }
        } catch (e) {}
        process.exit(1);
    }, 2000);
    forceExitTimer.unref();

    // 1. Synchronously kill cloudflared process tree if active
    if (cf && cf.pid) {
        try {
            spawnSync('taskkill', ['/F', '/T', '/PID', String(cf.pid)], { stdio: 'ignore' });
        } catch (e) {}
    }

    // 2. Terminate all client websockets cleanly
    for (const slot of slots) {
        if (slot.ws) {
            try { slot.ws.terminate(); } catch (e) {}
            slot.ws = null;
        }
    }
    for (const ws of audienceSockets) {
        try { ws.terminate(); } catch (e) {}
    }
    audienceSockets.clear();

    // 3. Close network servers and sockets
    try { wss.close(); } catch (e) {}
    try { server.close(); } catch (e) {}
    try { udpPort.close(); } catch (e) {}

    // 4. Remove PID file
    try {
        if (fs.existsSync(PID_FILE)) {
            const currentPid = fs.readFileSync(PID_FILE, 'utf8').trim();
            if (currentPid === String(process.pid)) {
                fs.unlinkSync(PID_FILE);
            }
        }
    } catch (e) {}

    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

server.listen(WS_PORT, '0.0.0.0', () => { printDashboard(); });

server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL] Port ${WS_PORT} is already in use! Exiting immediately...`);
        addLog(`[FATAL] Port ${WS_PORT} in use`);
        gracefulShutdown('EADDRINUSE');
    } else {
        console.error('[FATAL] Server error:', err.message);
        gracefulShutdown('SERVER_ERROR');
    }
});

process.on('uncaughtException', (err) => {
    addLog(`[UNCAUGHT] ${err.message}`);
    console.error("Uncaught Exception:", err);
});

process.on('unhandledRejection', (reason) => {
    addLog(`[UNHANDLED REJECTION] ${reason}`);
    console.error("Unhandled Rejection:", reason);
});
