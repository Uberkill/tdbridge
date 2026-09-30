const WebSocket = require('ws');
const http = require('http');

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:8080${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
            });
        }).on('error', reject);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("=== VERIFYING LIVE CHOP & DAT STREAM IN TOUCHDESIGNER ===");
    const roomInfo = await get('/health');
    const roomCode = roomInfo.room;
    console.log(`Connecting with room: ${roomCode}`);

    const ws = new WebSocket('ws://127.0.0.1:8080');

    await new Promise((resolve) => {
        ws.on('open', () => {
            console.log("WebSocket connected. Joining...");
            ws.send(JSON.stringify({ type: 'join', name: 'TesterPlayer', room: roomCode }));
        });

        ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'assigned_slot') {
                console.log(`Assigned Slot: ${msg.slot}`);
                resolve(msg.slot);
            }
        });
    });

    // Send control inputs: input, control (b1, s1)
    console.log("Sending control inputs: x=0.75, y=-0.42, b1=1, s1=0.88...");
    for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({ type: 'input', x: 0.75, y: -0.42 }));
        await sleep(20);
        ws.send(JSON.stringify({ type: 'control', id: 'b1', value: 1 }));
        await sleep(20);
        ws.send(JSON.stringify({ type: 'control', id: 's1', value: 0.88 }));
        await sleep(50);
    }

    console.log("Holding connection for TouchDesigner verification...");
    await sleep(6000);

    ws.close();
    console.log("Connection closed.");
}

run().catch(console.error);
