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
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
// @ts-ignore
const osc_1 = __importDefault(require("osc"));
// @ts-ignore
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const profiles_1 = require("./profiles");
const WS_PORT = 8080;
const OSC_PORT = 9000;
const MAX_USERS = 100;
const app = (0, express_1.default)();
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ server, maxPayload: 2048 });
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
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
// Profile REST APIs
app.get('/profile', (req, res) => {
    res.json({
        current: currentProfile,
        profile_type: profiles_1.BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        profiles: Object.keys(profiles_1.BUILTIN_PROFILES),
        blueprint: activeBlueprint
    });
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
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRTUVWXY346789";
function generateRoomCode() {
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
let currentProfile = 'gamepad';
let activeBlueprint = profiles_1.BUILTIN_PROFILES.gamepad.blueprint;
const LOG_FILE_PATH = path_1.default.join(__dirname, '../scratch_debug/error_log.txt');
const MAX_LOGS = 10;
const logs = [];
function addLog(msg) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const formattedMsg = `[${timestamp}] ${msg}`;
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
        catch (e) { }
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
        qrcode_terminal_1.default.generate(fullUrl, { small: true });
        console.log("=========================================================\n");
    }
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
    localPort: 9001,
    remoteAddress: "127.0.0.1",
    remotePort: OSC_PORT
});
udpPort.on("error", (err) => {
    addLog(`[OSC ERROR] ${err.message}`);
});
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
        else if (oscMsg.address === "/bridge/profile") {
            const requested = String(val || '').toLowerCase().trim();
            if (profiles_1.BUILTIN_PROFILES[requested]) {
                setProfile(requested);
            }
            else {
                addLog(`[PROFILE] Unknown profile requested via OSC: ${requested}`);
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
    catch (e) { }
});
udpPort.open();
udpPort.on("ready", () => {
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
});
function setProfile(profileName) {
    if (!profiles_1.BUILTIN_PROFILES[profileName])
        return;
    currentProfile = profileName;
    activeBlueprint = profiles_1.BUILTIN_PROFILES[profileName].blueprint;
    addLog(`[PROFILE] Switched active profile to: ${currentProfile.toUpperCase()}`);
    broadcastProfileChange();
}
function broadcastProfileChange() {
    const payload = JSON.stringify({
        type: 'profile_change',
        profile: currentProfile,
        profile_type: profiles_1.BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        ui_blueprint: activeBlueprint
    });
    for (const slot of slots) {
        if (slot.ws && slot.ws.readyState === ws_1.default.OPEN) {
            try {
                slot.ws.send(payload);
            }
            catch (e) { }
        }
    }
    requestRedraw();
}
// Run Cloudflare
const cf = (0, child_process_1.spawn)(path_1.default.join(__dirname, '../cloudflared.exe'), ['tunnel', '--url', `http://127.0.0.1:${WS_PORT}`]);
cf.stdout.on('data', () => { });
cf.stderr.on('data', (data) => {
    const output = data.toString();
    const match = output.match(/https:\/\/(.*\.trycloudflare\.com)/);
    if (match) {
        cloudflareUrl = "https://" + match[1];
        addLog(`[NETWORK] Tunnel established at ${cloudflareUrl}`);
        requestRedraw();
    }
});
cf.on('error', (err) => { addLog(`[FATAL] Failed to start cloudflared.exe: ${err.message}`); });
cf.on('close', (code) => { addLog(`[NETWORK] Tunnel exited (Code ${code})`); });
process.on('SIGINT', () => { if (cf)
    cf.kill(); process.exit(0); });
process.on('SIGTERM', () => { if (cf)
    cf.kill(); process.exit(0); });
process.on('exit', () => { if (cf)
    cf.kill(); });
const slots = Array.from({ length: MAX_USERS }, () => ({ ws: null, lastSeen: 0, lastMsg: 0, name: "" }));
// Slots 1-5 (indices 0-4) are reserved for background bot choir / demo agents
// Real players join in slots 6-100 (indices 5-99)
function getAvailableSlot() {
    return slots.findIndex((s, idx) => idx >= 5 && s.ws === null);
}
function updatePlayerCount() { activePlayers = slots.filter(s => s.ws !== null).length; requestRedraw(); }
function freeSlot(index) {
    if (index >= 0 && index < MAX_USERS && slots[index].ws !== null) {
        const name = slots[index].name;
        slots[index].ws = null;
        slots[index].name = "";
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
function sendOSC_Float(slotNumber, channel, value) {
    try {
        udpPort.send({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "f", value: value }] }, "127.0.0.1", OSC_PORT);
    }
    catch (e) { }
}
function sendOSC_String(slotNumber, channel, value) {
    try {
        udpPort.send({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "s", value: value }] }, "127.0.0.1", OSC_PORT);
    }
    catch (e) { }
}
const slotStates = {};
wss.on('connection', (ws) => {
    const slotIndex = getAvailableSlot();
    if (slotIndex === -1) {
        ws.send(JSON.stringify({ type: 'rejected' }));
        ws.close();
        return;
    }
    slots[slotIndex] = { ws: ws, lastSeen: Date.now(), lastMsg: 0, name: "Connecting..." };
    slotStates[slotIndex] = {};
    const playerNum = slotIndex + 1;
    // Handshake includes current profile & active blueprint for late-joiner sync
    ws.send(JSON.stringify({
        type: 'assigned_slot',
        slot: playerNum,
        profile: currentProfile,
        profile_type: profiles_1.BUILTIN_PROFILES[currentProfile]?.type || 'custom',
        ui_blueprint: activeBlueprint
    }));
    ws.on('error', (err) => { addLog(`[WS ERROR] Slot ${playerNum}: ${err.message}`); });
    ws.on('message', (message) => {
        try {
            const now = Date.now();
            if (slots[slotIndex] && slots[slotIndex].ws !== null) {
                if (now - slots[slotIndex].lastMsg < 15)
                    return; // 60Hz limit
                slots[slotIndex].lastMsg = now;
                slots[slotIndex].lastSeen = now;
            }
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
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
                const cleanName = typeof data.name === 'string' ? data.name.substring(0, 12) : "Anonymous";
                slots[slotIndex].name = cleanName;
                sendOSC_String(playerNum, "name", cleanName);
                sendOSC_Float(playerNum, "active", 1);
                addLog(`[CONNECT] Slot ${playerNum} registered as: ${cleanName}`);
                updatePlayerCount();
                return;
            }
            if (data.type === 'control') {
                const value = typeof data.value === 'number' ? data.value : (data.value ? 1 : 0);
                const key = String(data.id);
                if (slotStates[slotIndex][key] !== value) {
                    slotStates[slotIndex][key] = value;
                    sendOSC_Float(playerNum, key, value);
                    // Dual-channel mappings for full backward compatibility
                    if (key === 'b1')
                        sendOSC_Float(playerNum, 'action1', value);
                    if (key === 'b2')
                        sendOSC_Float(playerNum, 'action2', value);
                    if (key === 'b3')
                        sendOSC_Float(playerNum, 'action3', value);
                    if (key === 'action1')
                        sendOSC_Float(playerNum, 'b1', value);
                    if (key === 'action2')
                        sendOSC_Float(playerNum, 'b2', value);
                    if (key === 'action3')
                        sendOSC_Float(playerNum, 'b3', value);
                    if (key === 's1')
                        sendOSC_Float(playerNum, 'slider1', value);
                    if (key === 's2')
                        sendOSC_Float(playerNum, 'slider2', value);
                    if (key === 'slider1')
                        sendOSC_Float(playerNum, 's1', value);
                    if (key === 'slider2')
                        sendOSC_Float(playerNum, 's2', value);
                }
                return;
            }
            if (data.type === 'input') {
                const parsedX = parseFloat(data.x);
                const parsedY = parseFloat(data.y);
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
                sendOSC_Float(playerNum, "tap_rate", rate);
                sendOSC_Float(playerNum, "b1", 1);
                sendOSC_Float(playerNum, "action1", 1);
                setTimeout(() => {
                    sendOSC_Float(playerNum, "b1", 0);
                    sendOSC_Float(playerNum, "action1", 0);
                }, 50);
                return;
            }
            if (data.type === 'flush') {
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
        }
        catch (e) { }
    });
    ws.on('close', () => { freeSlot(slotIndex); });
});
// Watchdog & Heartbeat (8-second timeout to flush ghost inputs)
setInterval(() => {
    const now = Date.now();
    for (let i = 0; i < MAX_USERS; i++) {
        if (slots[i].ws !== null && now - slots[i].lastSeen > 8000) {
            addLog(`[TIMEOUT] Slot ${i + 1} inactive >8s. Reaping slot.`);
            try {
                slots[i].ws?.terminate();
            }
            catch (e) { }
            freeSlot(i);
        }
    }
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
}, 4000);
server.listen(WS_PORT, '0.0.0.0', () => { printDashboard(); });
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL] Port ${WS_PORT} is already in use! Exiting in 3s...`);
        addLog(`[FATAL] Port ${WS_PORT} in use`);
        setTimeout(() => process.exit(1), 3000);
    }
    else {
        console.error('[FATAL] Server error:', err.message);
        process.exit(1);
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
