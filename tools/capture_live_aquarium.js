const WebSocket = require('ws');
const http = require('http');

async function getRoomCode() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.room);
                } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const roomCode = await getRoomCode();
    console.log(`Connecting live player with room: ${roomCode}`);
    const ws = new WebSocket('ws://127.0.0.1:8080');

    let assigned = false;
    ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'join', name: 'MobyDick', room: roomCode }));
    });

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'assigned_slot') {
                assigned = true;
                console.log(`Assigned slot ${data.slot}`);
            }
        } catch(e) {}
    });

    while (!assigned) await sleep(100);

    // 1. Move MobyDick over to upper right
    console.log("Moving MobyDick to upper right...");
    for (let i = 0; i < 25; i++) {
        ws.send(JSON.stringify({ type: 'input', x: 0.7, y: 0.5 }));
        await sleep(40);
    }
    ws.send(JSON.stringify({ type: 'input', x: 0.0, y: 0.0 })); // release, stay in place
    await sleep(200);

    // 2. Set scale to 0.85
    ws.send(JSON.stringify({ type: 'control', id: 'slider2', value: 0.85 }));
    await sleep(100);

    // 3. Drop food pellet
    ws.send(JSON.stringify({ type: 'control', id: 'action3', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action3', value: 0 }));
    console.log("Dropped food pellet!");

    // Keep connection alive for 15 seconds so we can inspect and capture TouchDesigner state
    await sleep(15000);
    ws.close();
    console.log("Done!");
}

run().catch(console.error);
