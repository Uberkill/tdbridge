const WebSocket = require('ws');
const http = require('http');

async function getRoomCode() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                resolve(json.room);
            });
        }).on('error', reject);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("=== STARTING AUTOMATED TEST RUNNER ===");
    const room = await getRoomCode();
    console.log(`Active room: ${room}`);

    const ws = new WebSocket('ws://127.0.0.1:8080');
    let joined = false;
    let assignedSlot = -1;

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'assigned_slot') {
            assignedSlot = msg.slot;
            console.log(`Assigned Slot: ${assignedSlot}`);
            ws.send(JSON.stringify({ type: 'join', name: 'Sharky', room: room }));
            joined = true;
        }
    });

    while (!joined) await sleep(50);
    console.log("Joined as Sharky! Waiting 600ms for replication...");
    await sleep(600);

    console.log("Applying Joystick Input: left/up (-0.85, 0.6) for 1000ms...");
    const start = Date.now();
    while (Date.now() - start < 1000) {
        ws.send(JSON.stringify({ type: 'input', x: -0.85, y: 0.6 }));
        await sleep(30);
    }

    console.log("Releasing Joystick to Neutral (0, 0)...");
    ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
    await sleep(50);
    ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));

    console.log("Holding in place for 3000ms (Position Persistence Check)...");
    await sleep(3000);

    console.log("Triggering 360 Spin (action1)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 0 }));
    await sleep(500);

    console.log("Triggering Change Color (action2)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 0 }));
    await sleep(500);

    console.log("Keeping alive for 20000ms for TD screenshot capture...");
    await sleep(20000);

    console.log("Disconnecting...");
    ws.close();
    await sleep(500);
    console.log("Test script done.");
}

main().catch(console.error);
