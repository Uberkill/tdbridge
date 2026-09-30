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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    console.log("=== CUSTOM CONTROLS & DYNAMIC RESIZING TEST ===");
    const room = await getRoomCode();
    console.log(`Active Room: ${room}`);

    const ws = new WebSocket('ws://127.0.0.1:8080');
    let joined = false;
    let assignedSlot = -1;

    ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'join', role: 'performer', name: 'Moby_Dick', room: room }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'assigned_slot') {
            assignedSlot = msg.slot;
            console.log(`Assigned Slot: ${assignedSlot}`);
            console.log("Blueprint controls received:", msg.ui_blueprint.map(c => `${c.id}: ${c.label}`));
            joined = true;
        }
    });

    while (!joined) await sleep(50);
    console.log("Joined as Moby_Dick! Waiting 600ms for replication...");
    await sleep(600);

    console.log("1. Moving Moby_Dick to center-left (-0.7, 0.3)...");
    const start = Date.now();
    while (Date.now() - start < 1000) {
        ws.send(JSON.stringify({ type: 'input', x: -0.7, y: 0.3 }));
        await sleep(30);
    }
    ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
    await sleep(100);

    console.log("2. Adjusting Fish Size slider (slider2) to 0.85 (Enlarging fish)...");
    ws.send(JSON.stringify({ type: 'control', id: 'slider2', value: 0.85 }));
    await sleep(500);

    console.log("3. Triggering 360 Spin (action1)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 0 }));
    await sleep(600);

    console.log("4. Triggering Color Cycle (action2)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 0 }));
    await sleep(500);

    console.log("5. Holding session open for 15s for TouchDesigner inspection & screenshot...");
    await sleep(15000);

    console.log("6. Disconnecting Moby_Dick...");
    ws.close();
    await sleep(500);
    console.log("Custom controls test finished.");
}

main().catch(console.error);
