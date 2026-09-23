import WebSocket from 'ws';
// @ts-ignore - osc library typings are sometimes incomplete
import osc from 'osc';

const WS_PORT = 8080;
const OSC_PORT = 9000;
const MAX_USERS = 15;

const wss = new WebSocket.Server({ port: WS_PORT, maxPayload: 1024 });

// Generate a random 4-character room code on startup
const ACTIVE_ROOM_CODE = Math.random().toString(36).substring(2, 6).toUpperCase();

const udpPort = new osc.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 9001, 
    remoteAddress: "127.0.0.1",
    remotePort: OSC_PORT
});

udpPort.open();
udpPort.on("ready", () => {
    console.log(`OSC UDP Transmitter ready. Sending to 127.0.0.1:${OSC_PORT}`);
    console.log(`*** ACTIVE ROOM CODE: ${ACTIVE_ROOM_CODE} ***`);
    // Send room code to TouchDesigner (Slot 0 is used for system messages)
    sendOSC_String(0, "room_code", ACTIVE_ROOM_CODE);
});

interface SlotData {
    ws: WebSocket | null;
    lastSeen: number;
    lastMsg: number;
    name: string;
}

const slots: SlotData[] = Array.from({ length: MAX_USERS }, () => ({
    ws: null,
    lastSeen: 0,
    lastMsg: 0,
    name: ""
}));

function getAvailableSlot(): number {
    return slots.findIndex(s => s.ws === null);
}

function freeSlot(index: number) {
    if (index >= 0 && index < MAX_USERS && slots[index].ws !== null) {
        console.log(`Slot ${index + 1} (${slots[index].name}) freed.`);
        slots[index].ws = null;
        slots[index].name = "";
        
        // Reset TouchDesigner state for this slot
        sendOSC_Float(index + 1, "x", 0);
        sendOSC_Float(index + 1, "y", 0);
        sendOSC_String(index + 1, "name", ""); 
    }
}

function sendOSC_Float(slotNumber: number, channel: string, value: number) {
    udpPort.send({
        address: `/slot_${slotNumber}_${channel}`,
        args: [{ type: "f", value: value }]
    });
}

function sendOSC_String(slotNumber: number, channel: string, value: string) {
    udpPort.send({
        address: `/slot_${slotNumber}_${channel}`,
        args: [{ type: "s", value: value }]
    });
}

wss.on('connection', (ws: WebSocket) => {
    const slotIndex = getAvailableSlot();

    if (slotIndex === -1) {
        ws.send(JSON.stringify({ type: 'rejected' }));
        ws.close();
        return;
    }

    // Temporarily assign slot
    slots[slotIndex] = { ws: ws, lastSeen: Date.now(), lastMsg: 0, name: "Connecting..." };
    const playerNum = slotIndex + 1; 
    console.log(`Connection established. Assigned Slot ${playerNum}`);
    
    ws.send(JSON.stringify({ type: 'assigned_slot', slot: playerNum }));

    ws.on('message', (message: WebSocket.Data) => {
        try {
            const now = Date.now();
            if (slots[slotIndex] && slots[slotIndex].ws !== null) {
                // Rate Limiting (60Hz max)
                if (now - slots[slotIndex].lastMsg < 15) {
                    return; // Dropped
                }
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
                console.log(`Slot ${playerNum} registered as: ${cleanName}`);
                return;
            }

            if (data.type === 'button') {
                const state = data.state === 1 ? 1 : 0;
                sendOSC_Float(playerNum, String(data.name), state);
                return;
            }

            if (data.type === 'input') {
                const parsedX = parseFloat(data.x);
                const parsedY = parseFloat(data.y);
                const x = isNaN(parsedX) ? 0 : Math.max(-1, Math.min(1, parsedX));
                const y = isNaN(parsedY) ? 0 : Math.max(-1, Math.min(1, parsedY));
                
                sendOSC_Float(playerNum, "x", x);
                sendOSC_Float(playerNum, "y", y);
            }
        } catch (e) {
            console.error("Malformed message received.", e);
        }
    });

    ws.on('close', () => {
        freeSlot(slotIndex);
    });
});

setInterval(() => {
    const now = Date.now();
    for (let i = 0; i < MAX_USERS; i++) {
        if (slots[i].ws !== null) {
            if (now - slots[i].lastSeen > 15000) {
                console.log(`Slot ${i + 1} timed out.`);
                try {
                    slots[i].ws?.terminate();
                } catch(e) {}
                freeSlot(i);
            }
        }
    }
}, 5000);

console.log(`Relay Server running. WebSocket listening on ws://localhost:${WS_PORT}`);
