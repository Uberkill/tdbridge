const WebSocket = require('ws');
const http = require('http');

async function getRoomCode() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/room', (res) => {
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

async function connectPlayer(name, room) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://127.0.0.1:8080');
        let assignedSlot = -1;
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'assigned_slot') {
                assignedSlot = msg.slot;
                ws.send(JSON.stringify({ type: 'join', name: name, room: room }));
                resolve({ ws, slot: assignedSlot, name });
            }
        });
        ws.on('error', reject);
    });
}

async function main() {
    console.log("=== MULTI-PLAYER CONCURRENCY TEST ===");
    const room = await getRoomCode();
    console.log(`Room: ${room}`);

    const p1 = await connectPlayer("Nemo_Fan", room);
    console.log(`Player 1 joined: ${p1.name} (Slot ${p1.slot})`);
    await sleep(300);

    const p2 = await connectPlayer("Dory_Buddy", room);
    console.log(`Player 2 joined: ${p2.name} (Slot ${p2.slot})`);
    await sleep(600);

    console.log("Moving both players in opposite directions for 1000ms...");
    const start = Date.now();
    while (Date.now() - start < 1000) {
        p1.ws.send(JSON.stringify({ type: 'input', x: -0.8, y: -0.4 }));
        p2.ws.send(JSON.stringify({ type: 'input', x: 0.8, y: 0.4 }));
        await sleep(30);
    }

    console.log("Releasing both joysticks to neutral (0, 0)...");
    p1.ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
    p2.ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
    await sleep(100);

    console.log("P1 triggering Rotate, P2 triggering Color...");
    p1.ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 1 }));
    p2.ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 1 }));
    await sleep(100);
    p1.ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 0 }));
    p2.ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 0 }));
    await sleep(600);

    console.log("Holding in place for 10 seconds for TD inspection & screenshot...");
    await sleep(10000);

    console.log("Disconnecting Player 1 first (Testing slot gap resiliency)...");
    p1.ws.close();
    await sleep(3000);

    console.log("Disconnecting Player 2...");
    p2.ws.close();
    await sleep(1000);
    console.log("Multi-player test finished.");
}

main().catch(console.error);
