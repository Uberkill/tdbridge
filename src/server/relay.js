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
var ws_1 = __importDefault(require("ws"));
var express_1 = __importDefault(require("express"));
var http_1 = __importDefault(require("http"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var child_process_1 = require("child_process");
var readline = __importStar(require("readline"));
// @ts-ignore
var osc_1 = __importDefault(require("osc"));
// @ts-ignore
var qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
var WS_PORT = 8080;
var OSC_PORT = 9000;
var MAX_USERS = 100; // Increased to 100 per plan
var app = (0, express_1.default)();
var server = http_1.default.createServer(app);
var wss = new ws_1.default.Server({ server: server, maxPayload: 1024 });
app.use(express_1.default.static(path_1.default.join(__dirname, '../../public')));
app.get('/branding', function (req, res) {
    res.json({ project_name: "TouchDesigner Bridge", subtitle: "A Node.js OSC Relay", primary_color: "#1e88e5", bg_color: "#121212" });
});
var ACTIVE_ROOM_CODE = Math.random().toString(36).substring(2, 6).toUpperCase();
var activePlayers = 0;
var cloudflareUrl = "";
var tdFPS = "0.0";
var tdErrors = 0;
var LOG_FILE_PATH = path_1.default.join(__dirname, '../../error_log.txt');
// Rolling log buffer (Anti-Spam)
var MAX_LOGS = 10;
var logs = [];
function addLog(msg) {
    var timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    var formattedMsg = "[".concat(timestamp, "] ").concat(msg);
    // Persist critical errors to file
    if (msg.includes('ERROR') || msg.includes('FATAL')) {
        var dateStamp = new Date().toLocaleDateString('en-US');
        fs_1.default.appendFile(LOG_FILE_PATH, "[".concat(dateStamp, " ").concat(timestamp, "] ").concat(msg, "\n"), function (err) {
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
var redrawPending = false;
function requestRedraw() {
    if (!redrawPending) {
        redrawPending = true;
        setImmediate(function () {
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
    console.log("[NETWORK] Internet Status: ".concat(cloudflareUrl ? '[LIVE]' : '[CONNECTING...]'));
    console.log("[ROOM]    Room Code:       ".concat(ACTIVE_ROOM_CODE));
    console.log("[URL]     Public Address:  ".concat(cloudflareUrl || 'Waiting for Cloudflare...'));
    console.log("[PLAYERS] Active Players:  ".concat(activePlayers, " / ").concat(MAX_USERS));
    console.log("[SYSTEM]  TD Engine FPS:   ".concat(tdFPS, " fps  |  Errors: ").concat(tdErrors));
    console.log("=========================================================");
    if (cloudflareUrl) {
        console.log("\nScan to join:");
        var fullUrl = "".concat(cloudflareUrl, "/?room=").concat(ACTIVE_ROOM_CODE);
        qrcode_terminal_1.default.generate(fullUrl, { small: true });
        console.log("=========================================================\n");
        console.log("Telemetry Logs:");
        logs.forEach(function (l) { return console.log(l); });
    }
}
// Handle Terminal Resize
process.stdout.on('resize', requestRedraw);
// Set up OSC (Two-Way Telemetry)
var udpPort = new osc_1.default.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 9001,
    remoteAddress: "127.0.0.1",
    remotePort: OSC_PORT
});
udpPort.on("error", function (err) {
    addLog("[OSC ERROR] ".concat(err.message));
});
// Incoming Telemetry from TouchDesigner
udpPort.on("message", function (oscMsg) {
    try {
        if (oscMsg.address === "/td/fps") {
            var newFps = Number(oscMsg.args[0].value).toFixed(1);
            if (newFps !== tdFPS) {
                tdFPS = newFps;
                requestRedraw();
            }
        }
        else if (oscMsg.address === "/td/error") {
            tdErrors++;
            addLog("[TD ENGINE ERROR] ".concat(oscMsg.args[0].value));
        }
    }
    catch (e) { }
});
udpPort.open();
udpPort.on("ready", function () {
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
});
// Run Cloudflare
var cf = (0, child_process_1.spawn)(path_1.default.join(__dirname, '../../cloudflared.exe'), ['tunnel', '--url', "http://127.0.0.1:".concat(WS_PORT)]);
cf.stderr.on('data', function (data) {
    var output = data.toString();
    var match = output.match(/https:\/\/(.*\.trycloudflare\.com)/);
    if (match) {
        cloudflareUrl = "https://" + match[1];
        addLog("[NETWORK] Tunnel established at ".concat(cloudflareUrl));
        requestRedraw();
    }
});
cf.on('error', function (err) { addLog("[FATAL] Failed to start cloudflared.exe: ".concat(err.message)); });
cf.on('close', function (code) { addLog("[NETWORK] Tunnel exited (Code ".concat(code, ")")); });
// Clean up child process
process.on('SIGINT', function () { if (cf)
    cf.kill(); process.exit(0); });
process.on('SIGTERM', function () { if (cf)
    cf.kill(); process.exit(0); });
process.on('exit', function () { if (cf)
    cf.kill(); });
var slots = Array.from({ length: MAX_USERS }, function () { return ({ ws: null, lastSeen: 0, lastMsg: 0, name: "" }); });
function getAvailableSlot() { return slots.findIndex(function (s) { return s.ws === null; }); }
function updatePlayerCount() { activePlayers = slots.filter(function (s) { return s.ws !== null; }).length; requestRedraw(); }
function freeSlot(index) {
    if (index >= 0 && index < MAX_USERS && slots[index].ws !== null) {
        addLog("[DISCONNECT] Slot ".concat(index + 1, " (").concat(slots[index].name, ") left."));
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
        udpPort.send({ address: "/slot_".concat(slotNumber, "_").concat(channel), args: [{ type: "f", value: value }] });
    }
    catch (e) { }
}
function sendOSC_String(slotNumber, channel, value) {
    try {
        udpPort.send({ address: "/slot_".concat(slotNumber, "_").concat(channel), args: [{ type: "s", value: value }] });
    }
    catch (e) { }
}
// Scalability: Track last sent states to prevent redundant OSC spam
var slotStates = {};
wss.on('connection', function (ws) {
    var slotIndex = getAvailableSlot();
    if (slotIndex === -1) {
        ws.send(JSON.stringify({ type: 'rejected' }));
        ws.close();
        return;
    }
    slots[slotIndex] = { ws: ws, lastSeen: Date.now(), lastMsg: 0, name: "Connecting..." };
    slotStates[slotIndex] = {};
    var playerNum = slotIndex + 1;
    ws.send(JSON.stringify({ type: 'assigned_slot', slot: playerNum }));
    ws.on('error', function (err) { addLog("[WS ERROR] Slot ".concat(playerNum, ": ").concat(err.message)); });
    ws.on('message', function (message) {
        try {
            var now = Date.now();
            if (slots[slotIndex] && slots[slotIndex].ws !== null) {
                // Rate limiting (60Hz)
                if (now - slots[slotIndex].lastMsg < 15)
                    return;
                slots[slotIndex].lastMsg = now;
                slots[slotIndex].lastSeen = now;
            }
            var data = JSON.parse(message.toString());
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
                var cleanName = typeof data.name === 'string' ? data.name.substring(0, 12) : "Anonymous";
                slots[slotIndex].name = cleanName;
                sendOSC_String(playerNum, "name", cleanName);
                addLog("[CONNECT] Slot ".concat(playerNum, " registered as: ").concat(cleanName));
                updatePlayerCount();
                return;
            }
            if (data.type === 'control') {
                var value = typeof data.value === 'number' ? data.value : (data.value ? 1 : 0);
                if (slotStates[slotIndex][data.id] !== value) {
                    slotStates[slotIndex][data.id] = value;
                    sendOSC_Float(playerNum, String(data.id), value);
                }
                return;
            }
            if (data.type === 'input') {
                var parsedX = parseFloat(data.x);
                var parsedY = parseFloat(data.y);
                var x = isNaN(parsedX) ? 0 : Math.max(-1, Math.min(1, parsedX));
                var y = isNaN(parsedY) ? 0 : Math.max(-1, Math.min(1, parsedY));
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
    ws.on('close', function () { freeSlot(slotIndex); });
});
// GC / Heartbeat
setInterval(function () {
    var _a;
    var now = Date.now();
    for (var i = 0; i < MAX_USERS; i++) {
        if (slots[i].ws !== null && now - slots[i].lastSeen > 15000) {
            addLog("[TIMEOUT] Slot ".concat(i + 1, " timed out."));
            try {
                (_a = slots[i].ws) === null || _a === void 0 ? void 0 : _a.terminate();
            }
            catch (e) { }
            freeSlot(i);
        }
    }
}, 5000);
server.listen(WS_PORT, function () { printDashboard(); });
