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
const WS_PORT = 8080;
const OSC_PORT = 9000;
const MAX_USERS = 100; // Increased to 100 per plan
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ server, maxPayload: 1024 });
app.use(express_1.default.static(path_1.default.join(__dirname, '../../public')));
app.get('/branding', (req, res) => {
    res.json({ project_name: "TouchDesigner Bridge", subtitle: "A Node.js OSC Relay", primary_color: "#1e88e5", bg_color: "#121212" });
});
const ACTIVE_ROOM_CODE = Math.random().toString(36).substring(2, 6).toUpperCase();
let activePlayers = 0;
let cloudflareUrl = "";
let tdFPS = "0.0";
let tdErrors = 0;
const LOG_FILE_PATH = path_1.default.join(__dirname, '../../error_log.txt');
// Rolling log buffer (Anti-Spam)
const MAX_LOGS = 10;
const logs = [];
function addLog(msg) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const formattedMsg = `[${timestamp}] ${msg}`;
    // Persist critical errors to file
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
// UI Redraw Debouncing (Flicker-free ANSI rendering)
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
    // Clear and reset cursor
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    console.log("=========================================================");
    console.log("             TOUCHDESIGNER BRIDGE TERMINAL               ");
    console.log("=========================================================");
    console.log(`[NETWORK] Internet Status: ${cloudflareUrl ? '[LIVE]' : '[CONNECTING...]'}`);
    console.log(`[ROOM]    Room Code:       ${ACTIVE_ROOM_CODE}`);
    console.log(`[URL]     Public Address:  ${cloudflareUrl || 'Waiting for Cloudflare...'}`);
    console.log(`[PLAYERS] Active Players:  ${activePlayers} / ${MAX_USERS}`);
    console.log(`[SYSTEM]  TD Engine FPS:   ${tdFPS} fps  |  Errors: ${tdErrors}`);
    console.log("=========================================================");
    if (cloudflareUrl) {
        console.log("\nScan to join:");
        const fullUrl = `${cloudflareUrl}/?room=${ACTIVE_ROOM_CODE}`;
        qrcode_terminal_1.default.generate(fullUrl, { small: true });
        console.log("=========================================================\n");
        console.log("Telemetry Logs:");
        logs.forEach(l => console.log(l));
    }
}
// Handle Terminal Resize
process.stdout.on('resize', requestRedraw);
// Set up OSC (Two-Way Telemetry)
const udpPort = new osc_1.default.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 9001,
    remoteAddress: "127.0.0.1",
    remotePort: OSC_PORT
});
udpPort.on("error", (err) => {
    addLog(`[OSC ERROR] ${err.message}`);
});
// Incoming Telemetry from TouchDesigner
udpPort.on("message", (oscMsg) => {
    try {
        if (oscMsg.address === "/td/fps") {
            const newFps = Number(oscMsg.args[0].value).toFixed(1);
            if (newFps !== tdFPS) {
                tdFPS = newFps;
                requestRedraw();
            }
        }
        else if (oscMsg.address === "/td/error") {
            tdErrors++;
            addLog(`[TD ENGINE ERROR] ${oscMsg.args[0].value}`);
        }
    }
    catch (e) { }
});
udpPort.open();
udpPort.on("ready", () => {
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
});
// Run Cloudflare
const cf = (0, child_process_1.spawn)(path_1.default.join(__dirname, '../../cloudflared.exe'), ['tunnel', '--url', `http://127.0.0.1:${WS_PORT}`]);
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
// Clean up child process
process.on('SIGINT', () => { if (cf)
    cf.kill(); process.exit(0); });
process.on('SIGTERM', () => { if (cf)
    cf.kill(); process.exit(0); });
process.on('exit', () => { if (cf)
    cf.kill(); });
const slots = Array.from({ length: MAX_USERS }, () => ({ ws: null, lastSeen: 0, lastMsg: 0, name: "" }));
function getAvailableSlot() { return slots.findIndex(s => s.ws === null); }
function updatePlayerCount() { activePlayers = slots.filter(s => s.ws !== null).length; requestRedraw(); }
function freeSlot(index) {
    if (index >= 0 && index < MAX_USERS && slots[index].ws !== null) {
        addLog(`[DISCONNECT] Slot ${index + 1} (${slots[index].name}) left.`);
        slots[index].ws = null;
        slots[index].name = "";
        // State throttle/batching reset
        slotStates[index] = {};
        sendOSC_Float(index + 1, "x", 0);
        sendOSC_Float(index + 1, "y", 0);
        sendOSC_String(index + 1, "name", "");
        updatePlayerCount();
    }
}
function sendOSC_Float(slotNumber, channel, value) {
    try {
        udpPort.send({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "f", value: value }] });
    }
    catch (e) { }
}
function sendOSC_String(slotNumber, channel, value) {
    try {
        udpPort.send({ address: `/slot_${slotNumber}_${channel}`, args: [{ type: "s", value: value }] });
    }
    catch (e) { }
}
// Scalability: Track last sent states to prevent redundant OSC spam
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
    ws.send(JSON.stringify({ type: 'assigned_slot', slot: playerNum }));
    ws.on('error', (err) => { addLog(`[WS ERROR] Slot ${playerNum}: ${err.message}`); });
    ws.on('message', (message) => {
        try {
            const now = Date.now();
            if (slots[slotIndex] && slots[slotIndex].ws !== null) {
                // Rate limiting (60Hz)
                if (now - slots[slotIndex].lastMsg < 15)
                    return;
                slots[slotIndex].lastMsg = now;
                slots[slotIndex].lastSeen = now;
            }
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }
            if (data.type === 'join') {
                if (data.room !== ACTIVE_ROOM_CODE) {
                    ws.send(JSON.stringify({ type: 'rejected', reason: 'Invalid or Expired QR Code!' }));
                    ws.close();
                    return;
                }
                const cleanName = typeof data.name === 'string' ? data.name.substring(0, 12) : "Anonymous";
                slots[slotIndex].name = cleanName;
                sendOSC_String(playerNum, "name", cleanName);
                addLog(`[CONNECT] Slot ${playerNum} registered as: ${cleanName}`);
                updatePlayerCount();
                return;
            }
            if (data.type === 'control') {
                const value = typeof data.value === 'number' ? data.value : (data.value ? 1 : 0);
                if (slotStates[slotIndex][data.id] !== value) {
                    slotStates[slotIndex][data.id] = value;
                    sendOSC_Float(playerNum, String(data.id), value);
                }
                return;
            }
            if (data.type === 'input') {
                const parsedX = parseFloat(data.x);
                const parsedY = parseFloat(data.y);
                const x = isNaN(parsedX) ? 0 : Math.max(-1, Math.min(1, parsedX));
                const y = isNaN(parsedY) ? 0 : Math.max(-1, Math.min(1, parsedY));
                // Throttle identical continuous states
                if (slotStates[slotIndex]['x'] !== x) {
                    slotStates[slotIndex]['x'] = x;
                    sendOSC_Float(playerNum, "x", x);
                }
                if (slotStates[slotIndex]['y'] !== y) {
                    slotStates[slotIndex]['y'] = y;
                    sendOSC_Float(playerNum, "y", y);
                }
            }
        }
        catch (e) { }
    });
    ws.on('close', () => { freeSlot(slotIndex); });
});
// GC / Heartbeat
setInterval(() => {
    const now = Date.now();
    for (let i = 0; i < MAX_USERS; i++) {
        if (slots[i].ws !== null && now - slots[i].lastSeen > 15000) {
            addLog(`[TIMEOUT] Slot ${i + 1} timed out.`);
            try {
                slots[i].ws?.terminate();
            }
            catch (e) { }
            freeSlot(i);
        }
    }
}, 5000);
server.listen(WS_PORT, '0.0.0.0', () => { printDashboard(); });
