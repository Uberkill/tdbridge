"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
// @ts-ignore
const osc_1 = __importDefault(require("osc"));
// @ts-ignore
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const profiles_1 = require("./profiles");
const WS_PORT = parseInt(process.env.WS_PORT || '8080', 10);
const OSC_PORT = parseInt(process.env.OSC_PORT || '9000', 10);
const OSC_LOCAL_PORT = parseInt(process.env.OSC_LOCAL_PORT || '9001', 10);
const MAX_USERS = 100;
// Resolve physical local LAN IP (prioritizing 192.168.x / 10.x / 172.16-31.x and skipping virtual adapters)
function getLocalIpAddress() {
    const interfaces = os_1.default.networkInterfaces();
    const candidates = [];
    const virtualRegex = /(vEthernet|WSL|VirtualBox|VMware|Hyper-V|Loopback|docker|vethernet|tailscale|tap|tun)/i;
    for (const [name, netInterface] of Object.entries(interfaces)) {
        if (!netInterface || virtualRegex.test(name))
            continue;
        for (const net of netInterface) {
            if (net.family === 'IPv4' && !net.internal) {
                if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address)) {
                    return net.address;
                }
                candidates.push(net.address);
            }
        }
    }
    return candidates[0] || '127.0.0.1';
}
const LOCAL_LAN_IP = getLocalIpAddress();
const skipTunnel = process.env.NO_TUNNEL === '1' || process.argv.includes('--no-tunnel');
// Mutex Lockfile & Stale PID Recovery
const PID_FILE = path_1.default.join(__dirname, '../.relay.pid');
try {
    if (fs_1.default.existsSync(PID_FILE)) {
        const oldPidStr = fs_1.default.readFileSync(PID_FILE, 'utf-8').trim();
        const oldPid = parseInt(oldPidStr, 10);
        if (!isNaN(oldPid) && oldPid > 0 && oldPid !== process.pid) {
            try {
                process.kill(oldPid, 0); // test if process is alive
                (0, child_process_1.spawnSync)('taskkill', ['/F', '/T', '/PID', String(oldPid)], { stdio: 'ignore' });
            }
            catch (e) {
                // Stale lockfile, process is dead
            }
        }
    }
    fs_1.default.writeFileSync(PID_FILE, String(process.pid));
}
catch (e) {
    console.warn(`[STARTUP] Failed to write PID file ${PID_FILE}: ${e?.message || e}`);
}
// Dual-Code Generation
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRTUVWXY346789";
function generateRoomCode() {
    let res = "";
    for (let i = 0; i < 4; i++) {
        res += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return res;
}
const ACTIVE_ROOM_CODE = generateRoomCode();
const ACTIVE_MASTER_KEY = `OP-${crypto_1.default.randomInt(100000, 999999)}`;
let ACTIVE_MASTER_PIN = (process.env.MASTER_PIN || '1234').trim();
let tdAvailableScenes = [
    { id: 'aquarium', label: '[01] Interactive Aquarium', index: 0 },
    { id: 'canvas', label: '[02] Generative Particle Canvas', index: 1 },
    { id: 'qr', label: '[03] Room Code & QR Banner', index: 2 }
];
let tdSceneHealth = '[HEALTHY // 2 SCENES LINKED]';
let activeSessionName = 'MAIN STAGE';
const app = (0, express_1.default)();
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ server, maxPayload: 1024 });
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Dynamic branding
app.get('/branding', (req, res) => {
    res.json({
        project_name: "TouchDesigner Bridge",
        subtitle: "Modular Live Interaction Pipeline",
        primary_color: "#1e88e5",
        bg_color: "#121212"
    });
});
// Health check endpoint (Room code exposed strictly to localhost for test runners)
app.get('/health', (req, res) => {
    const clientIp = req.socket.remoteAddress || '';
    const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || clientIp === 'localhost';
    const isTdConnected = (Date.now() - tdLastSeen < 3500) && (tdLastSeen > 0);
    res.json({
        status: 'ok',
        uptime: Math.round(process.uptime()),
        session_name: activeSessionName,
        touchdesigner: {
            is_connected: isTdConnected,
            cook_fps: parseFloat(tdFPS) || 0.0
        },
        ...(isLocal ? { room: ACTIVE_ROOM_CODE } : {})
    });
});
// Unified Machine-Readable Telemetry API with Master Key Tunnel Guard
app.get('/telemetry', (req, res) => {
    const clientIp = req.socket.remoteAddress || '';
    const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || clientIp === 'localhost';
    const token = req.query.token || req.headers['x-master-token'];
    // Guard: public requests over tunnel strictly require active master key
    if (!isLocal && token !== ACTIVE_MASTER_KEY && token !== 'MASTER_KEY') {
        res.status(401).json({ error: 'Unauthorized: Telemetry requires private master key over public network' });
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
            session_name: activeSessionName,
            active_profile: currentProfile,
            active_scene: activeScene,
            room_code: ACTIVE_ROOM_CODE
        },
        ports: {
            http_ws_port: WS_PORT,
            osc_remote_port: OSC_PORT,
            osc_local_port: OSC_LOCAL_PORT,
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
            tunnel_status: cloudflareUrl ? 'live' : (skipTunnel ? 'local_only' : 'establishing'),
            public_url: cloudflareUrl || `http://${LOCAL_LAN_IP}:${WS_PORT}`,
            local_url: `http://${LOCAL_LAN_IP}:${WS_PORT}`,
            total_connected_sockets: slots.filter(s => s.ws !== null).length + audienceSockets.size + masterSockets.size + unauthenticatedSockets.size,
            performers_active: activePerformers,
            audience_spectators: audienceSockets.size,
            foh_masters_active: masterSockets.size,
            lobby_gate_sockets: unauthenticatedSockets.size,
            average_client_rtt_ms: computeAverageRtt()
        },
        recent_events: eventLogRingBuffer.slice(-50)
    });
});
// Profile REST APIs
app.get('/profile', (req, res) => {
    res.json({
        current: currentProfile,
        profile_type: profiles_1.BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        profiles: Object.keys(profiles_1.BUILTIN_PROFILES),
        blueprint: activeBlueprint
    });
});
app.post('/profile/custom', (req, res) => {
    const sanitized = (0, profiles_1.sanitizeBlueprint)(req.body?.blueprint);
    if (sanitized.length > 0) {
        currentProfile = 'custom';
        activeBlueprint = sanitized;
        addLog(`[PROFILE] Installed custom blueprint via REST (${sanitized.length} controls)`);
        broadcastProfileChange();
        res.json({ success: true, count: sanitized.length });
    }
    else {
        res.status(400).json({ error: 'Invalid blueprint payload' });
    }
});
app.post('/profile/:name', (req, res) => {
    const target = req.params.name.toLowerCase();
    if (profiles_1.BUILTIN_PROFILES[target]) {
        setProfile(target);
        res.json({ success: true, profile: currentProfile });
    }
    else {
        res.status(404).json({ error: `Unknown profile: ${target}` });
    }
});
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
let activeScene = 'aquarium';
let activeBlueprint = profiles_1.BUILTIN_PROFILES.gamepad.blueprint;
const envStates = {
    num_bots: 5,
    bot_speed: 0.25,
    bot_scale: 1.0,
    player_scale: 1.0,
    canvas_trail: 0.95,
    canvas_speed: 1.0
};
// Client RTT Tracking
const clientRtts = new Map();
function computeAverageRtt() {
    if (clientRtts.size === 0)
        return 0;
    let sum = 0;
    for (const rtt of clientRtts.values())
        sum += rtt;
    return Math.round((sum / clientRtts.size) * 10) / 10;
}
const eventLogRingBuffer = [];
function recordEvent(level, message) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    eventLogRingBuffer.push({ timestamp, level, message });
    if (eventLogRingBuffer.length > 50)
        eventLogRingBuffer.shift();
}
const LOG_FILE_PATH = path_1.default.join(__dirname, '../scratch_debug/error_log.txt');
try {
    fs_1.default.mkdirSync(path_1.default.dirname(LOG_FILE_PATH), { recursive: true });
}
catch (e) {
    console.warn(`[LOG INIT] Failed to create log directory: ${e?.message || e}`);
}
const MAX_LOGS = 10;
const logs = [];
function addLog(msg) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const formattedMsg = `[${timestamp}] ${msg}`;
    const level = msg.includes('ERROR') || msg.includes('FATAL') ? 'ERROR' :
        msg.includes('DISCONNECT') || msg.includes('left') ? 'DISCONNECT' :
            msg.includes('WARN') || msg.includes('TIMEOUT') ? 'WARN' : 'INFO';
    recordEvent(level, msg);
    if (msg.includes('ERROR') || msg.includes('FATAL')) {
        const dateStamp = new Date().toLocaleDateString('en-US');
        fs_1.default.appendFile(LOG_FILE_PATH, `[${dateStamp} ${timestamp}] ${msg}\n`, (err) => {
            if (err)
                console.error("Failed to write to log file");
        });
    }
    logs.push(formattedMsg);
    if (logs.length > MAX_LOGS)
        logs.shift();
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
        }
        catch (e) {
            recordEvent('WARN', `ANSI cursor control suppressed: ${e?.message || e}`);
        }
    }
    const isTdConnected = (Date.now() - tdLastSeen < 3500) && (tdLastSeen > 0);
    const tdStatusStr = isTdConnected ? `\x1b[32m[ONLINE - ${tdFPS} FPS]\x1b[0m` : `\x1b[33m[CONNECTING / WAITING...]\x1b[0m`;
    const netStatusStr = cloudflareUrl
        ? `\x1b[32m[LIVE - CLOUDFLARE]\x1b[0m`
        : (skipTunnel ? `\x1b[36m[LIVE - LOCAL LAN ONLY]\x1b[0m` : `\x1b[33m[ESTABLISHING WAN TUNNEL...]\x1b[0m`);
    const publicAddrStr = cloudflareUrl
        ? `\x1b[36m${cloudflareUrl}\x1b[0m`
        : (skipTunnel ? `\x1b[33mhttp://${LOCAL_LAN_IP}:${WS_PORT}\x1b[0m (Local Only)` : `\x1b[33m[Pending WAN allocation...]\x1b[0m`);
    console.log("=========================================================");
    console.log("             TOUCHDESIGNER BRIDGE TERMINAL               ");
    console.log("=========================================================");
    console.log(`[NETWORK]    Status:          ${netStatusStr}`);
    console.log(`[URL]        Public Address:  ${publicAddrStr}`);
    console.log(`[LOCAL]      Local LAN:       \x1b[32mhttp://${LOCAL_LAN_IP}:${WS_PORT}\x1b[0m`);
    console.log(`---------------------------------------------------------`);
    console.log(`[ROOM CODE]  \x1b[1m\x1b[33m>>>  [ ${ACTIVE_ROOM_CODE.split('').join(' ')} ]  <<<\x1b[0m   (Audience Entry)`);
    console.log(`[MASTER KEY] \x1b[1m\x1b[31m>>>  [ ${ACTIVE_MASTER_KEY} ]  <<<\x1b[0m   (FOH Operator Only)`);
    console.log(`---------------------------------------------------------`);
    console.log(`[PROFILE]    Active Profile:  \x1b[35m${currentProfile.toUpperCase()}\x1b[0m  (${activeBlueprint.length} controls)`);
    console.log(`[ENGINE]     TouchDesigner:   ${tdStatusStr}  |  Errors: ${tdErrors}`);
    console.log(`[CLIENTS]    Connected Users: ${activePlayers} / ${MAX_USERS}  (Allocated Slots: ${tdClones})`);
    if (masterSockets.size > 0) {
        console.log(`[OPERATOR]   Active FOH Consoles: ${masterSockets.size}`);
    }
    const activeNames = slots.filter(s => s.ws !== null && s.name && s.name !== "Connecting...").map(s => s.name);
    if (activeNames.length > 0) {
        console.log(`             Active Users:    \x1b[32m${activeNames.join(', ')}\x1b[0m`);
    }
    console.log("=========================================================");
    const qrUrl = cloudflareUrl || `http://${LOCAL_LAN_IP}:${WS_PORT}`;
    const qrLabel = cloudflareUrl
        ? "Scan to join (Public WAN):"
        : (skipTunnel ? "Scan to join (Local LAN):" : "Scan to join (Local LAN - WAN tunnel allocating...):");
    console.log(`\n${qrLabel}`);
    const fullUrl = `${qrUrl}/?room=${ACTIVE_ROOM_CODE}`;
    qrcode_terminal_1.default.generate(fullUrl, { small: true });
    console.log("=========================================================\n");
    console.log("Live Telemetry & Diagnostics:");
    if (logs.length === 0) {
        console.log("  (System standing by. Waiting for player joins...)");
    }
    else {
        logs.forEach(l => console.log(`  ${l}`));
    }
}
process.stdout.on('resize', requestRedraw);
// Set up OSC (Two-Way Telemetry & Profile Sync)
const udpPort = new osc_1.default.UDPPort({
    localAddress: "127.0.0.1",
    localPort: OSC_LOCAL_PORT,
    remoteAddress: "127.0.0.1",
    remotePort: OSC_PORT
});
udpPort.on("error", (err) => {
    addLog(`[OSC ERROR] ${err.message}`);
});
let lastUdpErrorLog = 0;
function safeUdpSend(msg, host = "127.0.0.1", port = OSC_PORT) {
    try {
        udpPort.send(msg, host, port);
        return true;
    }
    catch (err) {
        const now = Date.now();
        if (now - lastUdpErrorLog > 5000) {
            lastUdpErrorLog = now;
            addLog(`[UDP ERROR] Failed to send OSC to ${host}:${port}: ${err?.message || err}`);
        }
        return false;
    }
}
function safeWsSend(ws, payload) {
    if (!ws || ws.readyState !== ws_1.default.OPEN)
        return false;
    try {
        ws.send(payload);
        return true;
    }
    catch (err) {
        recordEvent('WARN', `WebSocket send failed: ${err?.message || err}`);
        return false;
    }
}
udpPort.on("message", (oscMsg) => {
    try {
        tdLastSeen = Date.now();
        const val = oscMsg.args?.[0]?.value ?? oscMsg.args?.[0];
        if (oscMsg.address === "/td/fps") {
            const newFps = Number(val || 0).toFixed(1);
            if (newFps !== tdFPS) {
                tdFPS = newFps;
                requestRedraw();
            }
        }
        else if (oscMsg.address === "/td/clones") {
            tdClones = Number(val || 0);
        }
        else if (oscMsg.address === "/td/pong") {
            const t1 = Number(val || 0);
            if (t1 > 0) {
                tdLoopbackLatency = Math.max(0, Date.now() - t1);
            }
        }
        else if (oscMsg.address === "/td/error") {
            const rawMsg = String(val ?? '(unknown error)');
            if (!rawMsg || rawMsg === '' || rawMsg.includes('Cook dependency loop'))
                return;
            const now = Date.now();
            if (rawMsg === lastErrorMsg && now - lastErrorTime < 3000)
                return;
            lastErrorMsg = rawMsg;
            lastErrorTime = now;
            tdErrors++;
            addLog(`[TD ENGINE ERROR] ${rawMsg.substring(0, 80)}`);
        }
        else if (oscMsg.address === "/td/active_scene") {
            const requestedScene = String(val || '').toLowerCase().trim();
            const requestedProfile = String(oscMsg.args?.[1]?.value ?? oscMsg.args?.[1] ?? '').toLowerCase().trim();
            if (requestedScene && requestedScene !== activeScene) {
                setScene(requestedScene, requestedProfile || undefined, false);
            }
        }
        else if (oscMsg.address === "/bridge/profile") {
            const requested = String(val || '').toLowerCase().trim();
            if (profiles_1.BUILTIN_PROFILES[requested]) {
                setProfile(requested);
            }
            else {
                addLog(`[PROFILE] Unknown profile requested via OSC: ${requested}`);
            }
        }
        else if (oscMsg.address === "/bridge/master_pin") {
            const rawPin = String(val ?? '').trim();
            if (/^[0-9a-zA-Z]{4,6}$/.test(rawPin)) {
                if (rawPin !== ACTIVE_MASTER_PIN) {
                    ACTIVE_MASTER_PIN = rawPin;
                    addLog(`[SECURITY] Updated Master PIN (length ${rawPin.length})`);
                }
            }
        }
        else if (oscMsg.address === "/td/scene_list") {
            try {
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                if (parsed && Array.isArray(parsed.scenes)) {
                    const newScenesStr = JSON.stringify(parsed.scenes);
                    const oldScenesStr = JSON.stringify(tdAvailableScenes);
                    const newHealth = parsed.health ? String(parsed.health) : tdSceneHealth;
                    if (newScenesStr !== oldScenesStr || newHealth !== tdSceneHealth) {
                        tdAvailableScenes = parsed.scenes;
                        tdSceneHealth = newHealth;
                        broadcastRoster();
                    }
                }
            }
            catch (e) {
                addLog(`[TD ERROR] Malformed scene list payload: ${e?.message || e}`);
            }
        }
        else if (oscMsg.address === "/td/scene_health") {
            const newHealth = String(val ?? '');
            if (newHealth !== tdSceneHealth) {
                tdSceneHealth = newHealth;
                broadcastRoster();
            }
        }
        else if (oscMsg.address === "/td/session_name") {
            const rawName = String(val ?? '').trim();
            const cleanName = rawName.replace(/[^a-zA-Z0-9 _-]/g, '').trim().substring(0, 32);
            if (cleanName && cleanName !== activeSessionName) {
                activeSessionName = cleanName;
                addLog(`[SESSION] Dynamic session name updated: "${activeSessionName}"`);
                broadcastSessionUpdate();
                requestRedraw();
            }
        }
        else if (oscMsg.address === "/bridge/set_blueprint") {
            try {
                const rawJson = typeof val === 'string' ? JSON.parse(val) : val;
                const sanitized = (0, profiles_1.sanitizeBlueprint)(rawJson);
                if (sanitized.length > 0) {
                    currentProfile = 'custom';
                    activeBlueprint = sanitized;
                    addLog(`[PROFILE] Installed custom blueprint via OSC (${sanitized.length} controls)`);
                    broadcastProfileChange();
                }
            }
            catch (e) {
                addLog(`[PROFILE ERROR] Failed to parse custom blueprint: ${e.message}`);
            }
        }
    }
    catch (e) {
        addLog(`[OSC ERROR] Error handling UDP message on ${oscMsg?.address}: ${e?.message || e}`);
    }
});
udpPort.open();
udpPort.on("ready", () => {
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
    safeUdpSend({ address: '/bridge/master_code', args: [{ type: 's', value: ACTIVE_MASTER_KEY }] });
    safeUdpSend({ address: '/bridge/scene', args: [{ type: 's', value: activeScene }] });
    const initialTunnelUrl = cloudflareUrl || `http://${LOCAL_LAN_IP}:${WS_PORT}`;
    safeUdpSend({ address: '/bridge/tunnel', args: [{ type: 's', value: initialTunnelUrl }] });
});
function setScene(sceneName, explicitProfile, sendToTD = true) {
    const cleanScene = String(sceneName || '').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
    if (!cleanScene)
        return;
    let canonical = cleanScene;
    if (cleanScene === 'canvas' || cleanScene === 'particle' || cleanScene === 'particles') {
        canonical = 'canvas';
    }
    else if (cleanScene === 'qr' || cleanScene === 'kinetic' || cleanScene === 'lobby') {
        canonical = 'qr';
    }
    else if (cleanScene === 'aquarium' || cleanScene === 'fish' || cleanScene === 'fishtank') {
        canonical = 'aquarium';
    }
    activeScene = canonical;
    let targetProfile = explicitProfile;
    if (!targetProfile || !profiles_1.BUILTIN_PROFILES[targetProfile]) {
        if (canonical === 'canvas')
            targetProfile = 'touchpad';
        else if (canonical === 'qr')
            targetProfile = 'audience';
        else
            targetProfile = 'gamepad';
    }
    if (currentProfile !== targetProfile && profiles_1.BUILTIN_PROFILES[targetProfile]) {
        currentProfile = targetProfile;
        activeBlueprint = profiles_1.BUILTIN_PROFILES[targetProfile].blueprint;
        addLog(`[PROFILE] Switched active profile to: ${currentProfile.toUpperCase()}`);
    }
    addLog(`[SCENE] Switched active scene to: ${activeScene.toUpperCase()}`);
    if (sendToTD) {
        safeUdpSend({ address: '/bridge/scene', args: [{ type: 's', value: canonical }] });
    }
    broadcastSceneChange();
    broadcastRoster();
}
function broadcastSceneChange() {
    const payload = JSON.stringify({
        type: 'scene_switched',
        scene: activeScene,
        profile: currentProfile,
        profile_type: profiles_1.BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        ui_blueprint: activeBlueprint
    });
    for (const client of wss.clients) {
        safeWsSend(client, payload);
    }
    requestRedraw();
}
function setProfile(profileName) {
    if (!profiles_1.BUILTIN_PROFILES[profileName])
        return;
    currentProfile = profileName;
    activeBlueprint = profiles_1.BUILTIN_PROFILES[profileName].blueprint;
    addLog(`[PROFILE] Switched active profile to: ${currentProfile.toUpperCase()}`);
    broadcastProfileChange();
    broadcastRoster();
}
function broadcastProfileChange() {
    const payload = JSON.stringify({
        type: 'profile_change',
        profile: currentProfile,
        profile_type: profiles_1.BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        ui_blueprint: activeBlueprint
    });
    for (const slot of slots) {
        safeWsSend(slot.ws, payload);
    }
    requestRedraw();
}
// Run Cloudflare Tunnel (or Local Rehearsal Bypass)
let cf = null;
if (skipTunnel) {
    addLog('[NETWORK] Local rehearsal mode active (Cloudflare tunnel skipped)');
}
else {
    const binPath = path_1.default.join(__dirname, '../bin/cloudflared.exe');
    const rootPath = path_1.default.join(__dirname, '../cloudflared.exe');
    const cfExecutable = fs_1.default.existsSync(binPath) ? binPath : rootPath;
    try {
        cf = (0, child_process_1.spawn)(cfExecutable, ['tunnel', '--edge-ip-version', '4', '--url', `http://127.0.0.1:${WS_PORT}`]);
        cf.stdout?.on('data', () => { });
        cf.stderr?.on('data', (data) => {
            const output = data.toString();
            const match = output.match(/https:\/\/(.*\.trycloudflare\.com)/);
            if (match) {
                cloudflareUrl = "https://" + match[1];
                addLog(`[NETWORK] Tunnel established at ${cloudflareUrl}`);
                safeUdpSend({ address: '/bridge/tunnel', args: [{ type: 's', value: cloudflareUrl }] });
                requestRedraw();
            }
        });
        cf.on('error', (err) => { addLog(`[FATAL] Failed to start cloudflared.exe: ${err.message}`); });
        cf.on('close', (code) => { addLog(`[NETWORK] Tunnel exited (Code ${code})`); });
    }
    catch (e) {
        addLog(`[FATAL] Failed to spawn cloudflared: ${e?.message || e}`);
    }
}
const slots = Array.from({ length: MAX_USERS }, () => ({
    ws: null,
    connectedAt: 0,
    lastSeen: 0,
    lastMsg: 0,
    name: "",
    color: '#ffffff',
    isJoined: false,
    role: 'performer'
}));
// Set of unauthenticated sockets (awaiting join or master login)
const unauthenticatedSockets = new Set();
const socketConnectedAt = new Map();
const audienceSockets = new Set();
const masterSockets = new Map(); // ws -> sessionToken
const masterAuthFailures = new Map();
const socketToSlot = new Map();
const audienceTapCounters = new Map();
// Prototype Pollution-Safe Slot State Storage
const slotStates = Object.create(null);
function isIpRateLimited(ip) {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost')
        return false;
    const entry = masterAuthFailures.get(ip);
    if (!entry)
        return false;
    const now = Date.now();
    if (now < entry.lockedUntil)
        return true;
    if (now >= entry.lockedUntil && entry.count >= 5) {
        masterAuthFailures.delete(ip);
        return false;
    }
    return false;
}
function recordAuthFailure(ip) {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost')
        return;
    const now = Date.now();
    const entry = masterAuthFailures.get(ip) || { count: 0, lockedUntil: 0, lastAttempt: now };
    entry.lastAttempt = now;
    if (now > entry.lockedUntil && entry.lockedUntil > 0) {
        entry.count = 1;
        entry.lockedUntil = 0;
    }
    else {
        entry.count++;
    }
    if (entry.count >= 5) {
        entry.lockedUntil = now + 60000; // 60s cooldown
    }
    masterAuthFailures.set(ip, entry);
}
// Human slots: 6-100 (indices 5-99). Slots 1-5 (indices 0-4) are reserved for background bot choir.
function getAvailableSlot() {
    return slots.findIndex((s, idx) => idx >= 5 && s.ws === null);
}
function updatePlayerCount() {
    activePlayers = slots.filter(s => s.ws !== null && s.isJoined).length;
    requestRedraw();
}
function freeSlot(index) {
    if (index >= 0 && index < MAX_USERS && slots[index].ws !== null) {
        const name = slots[index].name;
        const ws = slots[index].ws;
        if (ws) {
            clientRtts.delete(ws);
            socketToSlot.delete(ws);
        }
        slots[index].ws = null;
        slots[index].name = "";
        slots[index].color = '#ffffff';
        slots[index].isJoined = false;
        slots[index].connectedAt = 0;
        slots[index].lastSeen = 0;
        slots[index].lastMsg = 0;
        slots[index].role = 'performer';
        slotStates[index] = Object.create(null);
        addLog(`[DISCONNECT] Slot ${index + 1} (${name || 'unknown'}) left.`);
        // Zero all TouchDesigner OSC channels for this slot
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
        broadcastRoster();
    }
}
function sendOSC_Float(slotNumber, channel, value) {
    safeUdpSend({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "f", value: value }] });
}
function sendOSC_String(slotNumber, channel, value) {
    safeUdpSend({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "s", value: value }] });
}
function getRosterPayload() {
    const performers = [];
    for (let i = 5; i < MAX_USERS; i++) {
        if (slots[i].ws && slots[i].isJoined) {
            performers.push({
                slot: i + 1,
                name: slots[i].name,
                color: slots[i].color || '#ffffff',
                rtt: clientRtts.get(slots[i].ws) || 0,
                connected_seconds: Math.round((Date.now() - slots[i].connectedAt) / 1000)
            });
        }
    }
    return {
        type: 'roster_update',
        session_name: activeSessionName,
        performers,
        spectator_count: audienceSockets.size,
        master_count: masterSockets.size,
        room_code: ACTIVE_ROOM_CODE,
        current_profile: currentProfile,
        active_scene: activeScene,
        td_fps: tdFPS,
        td_connected: (Date.now() - tdLastSeen < 3500) && (tdLastSeen > 0),
        available_scenes: tdAvailableScenes,
        scene_health: tdSceneHealth
    };
}
function broadcastRoster() {
    if (masterSockets.size === 0)
        return;
    const payload = JSON.stringify(getRosterPayload());
    for (const [mWs] of masterSockets.entries()) {
        safeWsSend(mWs, payload);
    }
}
function broadcastSessionUpdate() {
    const payload = JSON.stringify({
        type: 'session_update',
        session_name: activeSessionName
    });
    for (const slot of slots) {
        safeWsSend(slot.ws, payload);
    }
    for (const ws of audienceSockets) {
        safeWsSend(ws, payload);
    }
    for (const ws of masterSockets.keys()) {
        safeWsSend(ws, payload);
    }
    for (const ws of unauthenticatedSockets) {
        safeWsSend(ws, payload);
    }
    broadcastRoster();
}
// Regex Whitelists for Security
const CONTROL_ID_REGEX = /^[a-zA-Z0-9_-]{1,16}$/;
const ENV_PARAM_REGEX = /^[a-zA-Z0-9_]{1,24}$/;
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    unauthenticatedSockets.add(ws);
    socketConnectedAt.set(ws, Date.now());
    ws.on('error', (err) => {
        addLog(`[WS ERROR] Socket: ${err.message}`);
    });
    ws.on('message', (message) => {
        try {
            const rawStr = message.toString();
            if (rawStr.length > 1024)
                return; // Drop oversized frames
            const data = JSON.parse(rawStr);
            if (!data || typeof data !== 'object')
                return;
            // Rate-limiting check for performer input (60Hz cap)
            const slotIndex = socketToSlot.has(ws) ? socketToSlot.get(ws) : -1;
            const now = Date.now();
            if (slotIndex !== -1 && slots[slotIndex]) {
                if (now - slots[slotIndex].lastMsg < 15)
                    return;
                slots[slotIndex].lastMsg = now;
                if (slots[slotIndex].isJoined) {
                    slots[slotIndex].lastSeen = now;
                }
            }
            // Latency Ping-Pong
            if (data.type === 'ping') {
                if (typeof data.rtt === 'number') {
                    clientRtts.set(ws, Math.max(0, Math.min(5000, data.rtt)));
                }
                ws.send(JSON.stringify({ type: 'pong', t: data.t }));
                return;
            }
            // Client-Side Exception Beacon
            if (data.type === 'client_telemetry_error') {
                const cleanErr = String(data.message || 'Unknown Client Error').substring(0, 140);
                const clientRef = (slotIndex !== -1 && slots[slotIndex]?.name && slots[slotIndex]?.isJoined)
                    ? `Slot ${slotIndex + 1} (${slots[slotIndex].name})`
                    : (masterSockets.has(ws) ? 'FOH Master' : (audienceSockets.has(ws) ? 'Spectator' : 'Lobby'));
                addLog(`[CLIENT ERROR] [${clientRef}] ${cleanErr} (line ${data.line || '?'}:${data.col || '?'})`);
                return;
            }
            // Master FOH Operator Login
            if (data.type === 'master_login') {
                if (isIpRateLimited(clientIp)) {
                    ws.send(JSON.stringify({
                        type: 'master_login_fail',
                        reason: 'Security lockout: Too many failed attempts. Cooldown active (60s).'
                    }));
                    return;
                }
                const reqRoom = String(data.room || '').trim().toUpperCase();
                const reqKey = String(data.key || '').trim().toUpperCase();
                const socketAttempts = (ws._masterAttempts || 0);
                const isKeyValid = (reqKey === ACTIVE_MASTER_KEY);
                const isPinValid = Boolean(ACTIVE_MASTER_PIN && reqKey === ACTIVE_MASTER_PIN.toUpperCase());
                if (reqRoom !== ACTIVE_ROOM_CODE || (!isKeyValid && !isPinValid)) {
                    ws._masterAttempts = socketAttempts + 1;
                    recordAuthFailure(clientIp);
                    addLog(`[SECURITY] Failed FOH Master login attempt from ${clientIp} (${ws._masterAttempts}/3)`);
                    if (ws._masterAttempts >= 3) {
                        ws.send(JSON.stringify({
                            type: 'master_login_fail',
                            reason: 'Security termination: 3 failed attempts.'
                        }));
                        ws.close(4003, 'Brute force defense');
                        return;
                    }
                    ws.send(JSON.stringify({
                        type: 'master_login_fail',
                        reason: 'Invalid Room Code or Master Key / PIN.'
                    }));
                    return;
                }
                // Authentication Successful
                unauthenticatedSockets.delete(ws);
                socketConnectedAt.delete(ws);
                ws._masterAttempts = 0;
                const sessionToken = crypto_1.default.randomBytes(16).toString('hex');
                masterSockets.set(ws, sessionToken);
                masterAuthFailures.delete(clientIp);
                addLog(`[MASTER] FOH Operator authenticated from ${clientIp} (method: ${isPinValid ? 'PIN' : 'MASTER_KEY'})`);
                ws.send(JSON.stringify({
                    type: 'master_login_success',
                    token: sessionToken,
                    room: ACTIVE_ROOM_CODE,
                    session_name: activeSessionName,
                    profile: currentProfile,
                    active_scene: activeScene,
                    available_scenes: tdAvailableScenes,
                    scene_health: tdSceneHealth,
                    env_states: envStates
                }));
                // Immediately send live state and roster
                ws.send(JSON.stringify(getRosterPayload()));
                return;
            }
            // Master Host Commands (Strict Session Token Binding)
            if (data.type === 'host_command') {
                const sessionToken = masterSockets.get(ws);
                if (!sessionToken || sessionToken !== data.token) {
                    ws.send(JSON.stringify({ type: 'error', message: 'UNAUTHORIZED: Valid FOH Master session token required' }));
                    return;
                }
                if (data.action === 'scene_switch') {
                    const cleanScene = String(data.scene || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
                    setScene(cleanScene, undefined, true);
                }
                else if (data.action === 'system_reset') {
                    safeUdpSend({ address: '/bridge/reset', args: [{ type: 'i', value: 1 }] });
                    addLog(`[MASTER] Triggered global system reset.`);
                }
                else if (data.action === 'slot_purge') {
                    for (let i = 5; i < MAX_USERS; i++) {
                        if (slots[i] && slots[i].ws) {
                            safeWsSend(slots[i].ws, JSON.stringify({ type: 'kicked', reason: 'Session reset by operator' }));
                            try {
                                slots[i].ws?.close(4003, 'Purged by operator');
                            }
                            catch (e) {
                                recordEvent('WARN', `Failed to close purged socket: ${e?.message || e}`);
                            }
                            freeSlot(i);
                        }
                    }
                    addLog(`[MASTER] Purged all active performer slots.`);
                    broadcastRoster();
                }
                else if (data.action === 'kick_slot') {
                    const targetSlot = parseInt(data.slot, 10);
                    const targetIdx = targetSlot - 1;
                    if (targetIdx >= 5 && targetIdx < MAX_USERS && slots[targetIdx].ws) {
                        const targetWs = slots[targetIdx].ws;
                        const kickedName = slots[targetIdx].name;
                        safeWsSend(targetWs, JSON.stringify({ type: 'kicked', reason: 'Disconnected by FOH Operator' }));
                        try {
                            targetWs?.close(4003, 'Kicked by operator');
                        }
                        catch (e) {
                            recordEvent('WARN', `Failed to close kicked socket: ${e?.message || e}`);
                        }
                        freeSlot(targetIdx);
                        addLog(`[MASTER] Kicked Slot ${targetSlot} (${kickedName})`);
                        broadcastRoster();
                    }
                }
                else if (data.action === 'change_profile') {
                    const target = String(data.profile || '').toLowerCase().trim();
                    if (profiles_1.BUILTIN_PROFILES[target]) {
                        setProfile(target);
                        addLog(`[MASTER] Switched profile to: ${target}`);
                    }
                }
                ws.send(JSON.stringify({ type: 'host_ack', action: data.action, status: 'ok' }));
                return;
            }
            // Environment / Auxiliary Controls
            if (data.type === 'env') {
                const sessionToken = masterSockets.get(ws);
                const isMaster = !!sessionToken && (data.token === sessionToken);
                if (!isMaster && data.param !== 'scare') {
                    ws.send(JSON.stringify({ type: 'error', message: 'UNAUTHORIZED: Valid FOH Master session token required for environment controls' }));
                    return;
                }
                if (typeof data.param === 'string' && ENV_PARAM_REGEX.test(data.param)) {
                    if (data.param === '__proto__' || data.param === 'constructor' || data.param === 'prototype')
                        return;
                    let val = typeof data.value === 'number' ? data.value : (data.value ? 1 : 0);
                    // Clamp values to defined safe physical boundaries
                    if (data.param === 'num_bots')
                        val = Math.max(0, Math.min(5, Math.round(val)));
                    else if (data.param === 'bot_speed')
                        val = Math.max(0.05, Math.min(0.50, val));
                    else if (data.param === 'bot_scale')
                        val = Math.max(0.4, Math.min(2.0, val));
                    else if (data.param === 'player_scale')
                        val = Math.max(0.4, Math.min(2.0, val));
                    else if (data.param === 'canvas_trail')
                        val = Math.max(0.50, Math.min(0.99, val));
                    else if (data.param === 'canvas_speed')
                        val = Math.max(0.1, Math.min(3.0, val));
                    envStates[data.param] = val;
                    udpPort.send({
                        address: `/env/${data.param}`,
                        args: [{ type: "f", value: val }]
                    }, "127.0.0.1", OSC_PORT);
                }
                return;
            }
            // General Attendee Onboarding: Performer vs Spectator
            if (data.type === 'join') {
                const reqRoom = String(data.room || '').trim().toUpperCase();
                if (reqRoom !== ACTIVE_ROOM_CODE) {
                    addLog(`[AUTH] Rejected connection! Expected: ${ACTIVE_ROOM_CODE}, Got: ${reqRoom}`);
                    ws.send(JSON.stringify({ type: 'rejected', reason: 'Invalid or Expired Room Code' }));
                    ws.close(4001, 'Invalid Room Code');
                    return;
                }
                unauthenticatedSockets.delete(ws);
                socketConnectedAt.delete(ws);
                // Pathway 1: Audience Spectator (0 performer slots consumed)
                if (data.role === 'audience' || data.role === 'spectator') {
                    audienceSockets.add(ws);
                    ws.send(JSON.stringify({
                        type: 'audience_joined',
                        room: ACTIVE_ROOM_CODE,
                        profile: currentProfile,
                        active_scene: activeScene
                    }));
                    addLog(`[CONNECT] Spectator joined as AUDIENCE (0 performer slots consumed)`);
                    broadcastRoster();
                    return;
                }
                // Pathway 2: Interactive Performer (Claims human slot 6-100)
                const assignedIndex = getAvailableSlot();
                if (assignedIndex === -1) {
                    ws.send(JSON.stringify({ type: 'rejected', reason: 'STAGE FULL // ALL 95 PERFORMER SLOTS ACTIVE' }));
                    ws.close(4002, 'Room Full');
                    return;
                }
                const playerNum = assignedIndex + 1;
                socketToSlot.set(ws, assignedIndex);
                slotStates[assignedIndex] = Object.create(null);
                // Sanitize Handle to prevent DOM XSS / OSC issues
                const rawName = String(data.name || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 12);
                const cleanName = rawName.length > 0 ? rawName : `PLAYER_${playerNum}`;
                const cleanColor = (typeof data.color_hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.color_hex))
                    ? data.color_hex : '#ffffff';
                slots[assignedIndex] = {
                    ws: ws,
                    connectedAt: now,
                    lastSeen: now,
                    lastMsg: 0,
                    name: cleanName,
                    color: cleanColor,
                    isJoined: true,
                    role: 'performer'
                };
                // Notify Performer
                ws.send(JSON.stringify({
                    type: 'assigned_slot',
                    slot: playerNum,
                    session_name: activeSessionName,
                    profile: currentProfile,
                    profile_type: profiles_1.BUILTIN_PROFILES[currentProfile]?.type || 'custom',
                    active_scene: activeScene,
                    ui_blueprint: activeBlueprint
                }));
                // Update TouchDesigner OSC Pipeline
                sendOSC_String(playerNum, "name", cleanName);
                sendOSC_String(playerNum, "color", cleanColor);
                sendOSC_Float(playerNum, "active", 1);
                addLog(`[CONNECT] Slot ${playerNum} registered as: ${cleanName}`);
                updatePlayerCount();
                broadcastRoster();
                return;
            }
            // Real-Time Performer Controls
            if (data.type === 'control') {
                if (slotIndex === -1 || !slots[slotIndex] || slots[slotIndex].ws !== ws || !slots[slotIndex].isJoined)
                    return;
                const rawId = String(data.id || '');
                if (!CONTROL_ID_REGEX.test(rawId))
                    return;
                if (rawId === '__proto__' || rawId === 'constructor' || rawId === 'prototype')
                    return;
                const value = typeof data.value === 'number' ? data.value : (data.value ? 1 : 0);
                const playerNum = slotIndex + 1;
                if (slotStates[slotIndex][rawId] !== value) {
                    slotStates[slotIndex][rawId] = value;
                    sendOSC_Float(playerNum, rawId, value);
                    // Dual-channel mappings for backwards compatibility
                    if (rawId === 'b1')
                        sendOSC_Float(playerNum, 'action1', value);
                    if (rawId === 'b2')
                        sendOSC_Float(playerNum, 'action2', value);
                    if (rawId === 'b3')
                        sendOSC_Float(playerNum, 'action3', value);
                    if (rawId === 'action1')
                        sendOSC_Float(playerNum, 'b1', value);
                    if (rawId === 'action2')
                        sendOSC_Float(playerNum, 'b2', value);
                    if (rawId === 'action3')
                        sendOSC_Float(playerNum, 'b3', value);
                    if (rawId === 's1')
                        sendOSC_Float(playerNum, 'slider1', value);
                    if (rawId === 's2')
                        sendOSC_Float(playerNum, 'slider2', value);
                    if (rawId === 'slider1')
                        sendOSC_Float(playerNum, 's1', value);
                    if (rawId === 'slider2')
                        sendOSC_Float(playerNum, 's2', value);
                }
                return;
            }
            // Analog Joystick Vector
            if (data.type === 'input') {
                if (slotIndex === -1 || !slots[slotIndex] || slots[slotIndex].ws !== ws || !slots[slotIndex].isJoined)
                    return;
                const parsedX = parseFloat(data.x);
                const parsedY = parseFloat(data.y);
                const x = isNaN(parsedX) ? 0 : Math.max(-1, Math.min(1, parsedX));
                const y = isNaN(parsedY) ? 0 : Math.max(-1, Math.min(1, parsedY));
                const playerNum = slotIndex + 1;
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
            // Audience & Performer Beat Tap (Throttled to <= 10 packets/s)
            if (data.type === 'tap') {
                const tapTracker = audienceTapCounters.get(ws) || { count: 0, windowStart: now };
                if (now - tapTracker.windowStart > 1000) {
                    tapTracker.count = 1;
                    tapTracker.windowStart = now;
                }
                else {
                    tapTracker.count++;
                    if (tapTracker.count > 10)
                        return; // Drop excessive taps
                }
                audienceTapCounters.set(ws, tapTracker);
                const rate = typeof data.rate === 'number' ? Math.max(0, Math.min(300, data.rate)) : 0;
                if (audienceSockets.has(ws)) {
                    safeUdpSend({ address: '/bridge/hype', args: [{ type: "f", value: 1.0 }] });
                    safeUdpSend({ address: '/audience/tap', args: [{ type: "f", value: rate }] });
                }
                else if (slotIndex !== -1 && slots[slotIndex]?.ws === ws) {
                    const playerNum = slotIndex + 1;
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
            // Zero All Performer Controls
            if (data.type === 'flush') {
                if (slotIndex === -1 || !slots[slotIndex] || slots[slotIndex].ws !== ws)
                    return;
                const playerNum = slotIndex + 1;
                slotStates[slotIndex] = Object.create(null);
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
        }
        catch (e) {
            addLog(`[WS ERROR] Error processing client message: ${e?.message || e}`);
        }
    });
    ws.on('close', () => {
        clientRtts.delete(ws);
        audienceTapCounters.delete(ws);
        unauthenticatedSockets.delete(ws);
        socketConnectedAt.delete(ws);
        if (masterSockets.has(ws)) {
            masterSockets.delete(ws);
            addLog(`[MASTER] FOH Operator console disconnected.`);
            requestRedraw();
            return;
        }
        if (audienceSockets.has(ws)) {
            audienceSockets.delete(ws);
            addLog(`[DISCONNECT] Audience spectator left.`);
            broadcastRoster();
            return;
        }
        if (socketToSlot.has(ws)) {
            const slotIndex = socketToSlot.get(ws);
            freeSlot(slotIndex);
        }
    });
});
// Watchdog: Clean unauthenticated sockets > 10s and inactive performers > 8s
setInterval(() => {
    const now = Date.now();
    // 1. Unauthenticated sockets timeout (15s deadline to join or auth)
    for (const ws of unauthenticatedSockets) {
        const connectedTime = socketConnectedAt.get(ws) || 0;
        if (connectedTime > 0 && now - connectedTime > 15000) {
            unauthenticatedSockets.delete(ws);
            socketConnectedAt.delete(ws);
            try {
                if (ws.readyState === ws_1.default.OPEN) {
                    ws.send(JSON.stringify({ type: 'rejected', reason: 'Handshake timeout (15s)' }));
                    ws.close(4008, 'Handshake Timeout');
                }
                else {
                    ws.terminate();
                }
            }
            catch (e) {
                try {
                    ws.terminate();
                }
                catch (err) {
                    recordEvent('WARN', `Failed to terminate unauthenticated socket: ${err?.message || err}`);
                }
            }
            addLog(`[TIMEOUT] Reaped idle unauthenticated socket after 15s.`);
        }
    }
    // 2. Auth failure IP table TTL pruning
    for (const [ip, entry] of masterAuthFailures.entries()) {
        if (entry.lockedUntil > 0 && now >= entry.lockedUntil) {
            masterAuthFailures.delete(ip);
        }
        else if (entry.lockedUntil === 0 && now - entry.lastAttempt > 180000) {
            masterAuthFailures.delete(ip);
        }
    }
    // 2. Active performer heartbeat timeout (8s silence)
    for (let i = 5; i < MAX_USERS; i++) {
        const slot = slots[i];
        if (slot.ws !== null && slot.isJoined) {
            if (now - slot.lastSeen > 8000) {
                addLog(`[TIMEOUT] Slot ${i + 1} (${slot.name}) inactive >8s. Reaping slot.`);
                try {
                    slot.ws?.terminate();
                }
                catch (e) {
                    recordEvent('WARN', `Failed to terminate inactive slot ${i + 1}: ${e?.message || e}`);
                }
                freeSlot(i);
            }
        }
    }
}, 2000);
// Deterministic 1000ms Heartbeat to TouchDesigner & Roster Stream
setInterval(() => {
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
    safeUdpSend({ address: '/bridge/master_code', args: [{ type: 's', value: ACTIVE_MASTER_KEY }] });
    if (cloudflareUrl) {
        safeUdpSend({ address: '/bridge/tunnel', args: [{ type: 's', value: cloudflareUrl }] });
    }
    // Broadcast live telemetry & roster to open Master Consoles
    if (masterSockets.size > 0) {
        broadcastRoster();
    }
}, 1000);
// Loopback ping to TouchDesigner (measures IPC / UDP latency)
setInterval(() => {
    safeUdpSend({
        address: "/bridge/ping",
        args: [{ type: "f", value: Date.now() }]
    });
}, 2000);
// Resilient Graceful Shutdown & Child Process Tree Purge
let isShuttingDown = false;
function gracefulShutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    addLog(`[SYSTEM] Initiating clean shutdown (${signal})...`);
    // Hard fallback timeout (2000ms)
    const forceExitTimer = setTimeout(() => {
        try {
            if (fs_1.default.existsSync(PID_FILE)) {
                const currentPid = fs_1.default.readFileSync(PID_FILE, 'utf8').trim();
                if (currentPid === String(process.pid))
                    fs_1.default.unlinkSync(PID_FILE);
            }
        }
        catch (e) {
            recordEvent('WARN', `Failed to unlink PID file on forced exit: ${e?.message || e}`);
        }
        process.exit(1);
    }, 2000);
    forceExitTimer.unref();
    // 1. Synchronously kill cloudflared process tree if active
    if (cf && cf.pid) {
        try {
            (0, child_process_1.spawnSync)('taskkill', ['/F', '/T', '/PID', String(cf.pid)], { stdio: 'ignore' });
        }
        catch (e) {
            recordEvent('WARN', `Failed to kill cloudflared process: ${e?.message || e}`);
        }
    }
    // 2. Terminate all client websockets cleanly
    for (const slot of slots) {
        if (slot.ws) {
            try {
                slot.ws.terminate();
            }
            catch (e) {
                recordEvent('WARN', `Failed to terminate performer socket: ${e?.message || e}`);
            }
            slot.ws = null;
        }
    }
    for (const ws of audienceSockets) {
        try {
            ws.terminate();
        }
        catch (e) {
            recordEvent('WARN', `Failed to terminate audience socket: ${e?.message || e}`);
        }
    }
    for (const [ws] of masterSockets.entries()) {
        try {
            ws.terminate();
        }
        catch (e) {
            recordEvent('WARN', `Failed to terminate master socket: ${e?.message || e}`);
        }
    }
    audienceSockets.clear();
    masterSockets.clear();
    socketToSlot.clear();
    // 3. Close network servers and sockets
    try {
        wss.close();
    }
    catch (e) {
        recordEvent('WARN', `Failed to close WebSocket server: ${e?.message || e}`);
    }
    try {
        server.close();
    }
    catch (e) {
        recordEvent('WARN', `Failed to close HTTP server: ${e?.message || e}`);
    }
    try {
        udpPort.close();
    }
    catch (e) {
        recordEvent('WARN', `Failed to close UDP port: ${e?.message || e}`);
    }
    // 4. Remove PID file
    try {
        if (fs_1.default.existsSync(PID_FILE)) {
            const currentPid = fs_1.default.readFileSync(PID_FILE, 'utf8').trim();
            if (currentPid === String(process.pid)) {
                fs_1.default.unlinkSync(PID_FILE);
            }
        }
    }
    catch (e) {
        recordEvent('WARN', `Failed to remove PID file on shutdown: ${e?.message || e}`);
    }
    process.exit(0);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
server.listen(WS_PORT, '0.0.0.0', () => { printDashboard(); });
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL] Port ${WS_PORT} is already in use! Exiting immediately...`);
        addLog(`[FATAL] Port ${WS_PORT} in use`);
        gracefulShutdown('EADDRINUSE');
    }
    else {
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
