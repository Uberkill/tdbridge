const WebSocket = require('ws');
const osc = require('osc');

const WS_PORT = 8080;
const OSC_PORT = 9000;
const MAX_USERS = 15;

// Create WebSocket Server with strict payload limits (1KB max per message) to prevent memory flooding
const wss = new WebSocket.Server({ port: WS_PORT, maxPayload: 1024 });

// Create UDP OSC Sender (pointing to local TouchDesigner)
const udpPort = new osc.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 9001, // Node listens here but we don't care about incoming UDP
    remoteAddress: "127.0.0.1",
    remotePort: OSC_PORT
});

udpPort.open();
udpPort.on("ready", () => {
    console.log(`OSC UDP Transmitter ready. Sending to 127.0.0.1:${OSC_PORT}`);
});

// Slot Management
// Array of objects { ws: WebSocket|null, lastSeen: timestamp, lastMsg: timestamp }
const slots = Array(MAX_USERS).fill(null);

function getAvailableSlot() {
    return slots.findIndex(s => s === null);
}

function freeSlot(index) {
    if (index >= 0 && index < MAX_USERS && slots[index] !== null) {
        console.log(`Slot ${index + 1} freed.`);
        slots[index] = null;
        // Send a 0,0 to TouchDesigner to reset this slot instantly
        sendOSC(index + 1, 0, 0);
    }
}

function sendOSC(slotNumber, x, y) {
    // Send standard OSC message matching TD's expected CHOP channels
    udpPort.send({
        address: `/slot_${slotNumber}_x`,
        args: [{ type: "f", value: x }]
    });
    udpPort.send({
        address: `/slot_${slotNumber}_y`,
        args: [{ type: "f", value: y }]
    });
}

wss.on('connection', (ws) => {
    const slotIndex = getAvailableSlot();

    if (slotIndex === -1) {
        ws.send(JSON.stringify({ type: 'rejected' }));
        ws.close();
        return;
    }

    // Assign slot
    slots[slotIndex] = { ws: ws, lastSeen: Date.now(), lastMsg: 0 };
    const playerNum = slotIndex + 1; // 1-indexed for TouchDesigner readability
    console.log(`Player connected. Assigned Slot ${playerNum}`);
    
    ws.send(JSON.stringify({ type: 'assigned_slot', slot: playerNum }));

    ws.on('message', (message) => {
        try {
            const now = Date.now();
            
            // SERVER-SIDE RATE LIMITING: Drop packets if sent faster than 15ms (~60Hz)
            // This protects Node.js from CPU starvation if a hacker writes a bot to spam the socket.
            if (slots[slotIndex]) {
                if (now - slots[slotIndex].lastMsg < 15) {
                    return; // Silently drop spam packet
                }
                slots[slotIndex].lastMsg = now;
                slots[slotIndex].lastSeen = now;
            }

            const data = JSON.parse(message);

            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }

            if (data.type === 'button') {
                const state = data.state === 1 ? 1 : 0;
                udpPort.send({
                    address: `/slot_${playerNum}_${data.name}`,
                    args: [{ type: "f", value: state }]
                });
                return;
            }

            if (data.type === 'input') {
                // Defensive programming: ensure numbers, protect against NaN, and clamp
                const parsedX = parseFloat(data.x);
                const parsedY = parseFloat(data.y);
                const x = isNaN(parsedX) ? 0 : Math.max(-1, Math.min(1, parsedX));
                const y = isNaN(parsedY) ? 0 : Math.max(-1, Math.min(1, parsedY));
                sendOSC(playerNum, x, y);
            }
        } catch (e) {
            console.error("Malformed message received.");
        }
    });

    ws.on('close', () => {
        freeSlot(slotIndex);
    });
});

// ---------------------------------------------------------
// ZOMBIE SOCKET WATCHDOG (Critical Fix from Pre-Mortem)
// ---------------------------------------------------------
// Check every 5 seconds for sockets that haven't sent a ping or message in 15 seconds
setInterval(() => {
    const now = Date.now();
    for (let i = 0; i < MAX_USERS; i++) {
        if (slots[i] !== null) {
            if (now - slots[i].lastSeen > 15000) {
                console.log(`Slot ${i + 1} timed out (Zombie Socket). Kicking.`);
                try {
                    slots[i].ws.terminate(); // Force close
                } catch(e) {}
                freeSlot(i);
            }
        }
    }
}, 5000);

console.log(`Relay Server running. WebSocket listening on ws://localhost:${WS_PORT}`);
