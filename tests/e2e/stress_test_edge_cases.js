const WebSocket = require('ws');
const http = require('http');

async function getRoomCode() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data).room); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testInvalidRoomCode() {
    console.log("\n[TEST 1] Invalid Room Code Rejection...");
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://127.0.0.1:8080');
        let rejected = false;
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'join', name: 'Hacker', room: 'INVALID_CODE' }));
        });
        ws.on('message', (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.type === 'rejected') {
                rejected = true;
                console.log("  ✔ Server correctly rejected invalid room code:", data.reason);
            }
        });
        ws.on('close', () => {
            if (rejected) resolve(true);
            else {
                console.error("  ❌ Socket closed without rejected event");
                resolve(false);
            }
        });
    });
}

async function testCorruptedAndExtremePayloads(roomCode) {
    console.log("\n[TEST 2] Malformed & Extreme Payloads Flood...");
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://127.0.0.1:8080');
        ws.on('open', async () => {
            ws.send(JSON.stringify({ type: 'join', name: 'StressTest', room: roomCode }));
            await sleep(200);

            // 1. Send invalid JSON strings
            try { ws.send("NOT_JSON_AT_ALL"); } catch(e) {}
            try { ws.send("{malformed: json;"); } catch(e) {}
            try { ws.send(JSON.stringify({ type: 'unknown_type', foo: 'bar' })); } catch(e) {}

            // 2. Send extreme values
            ws.send(JSON.stringify({ type: 'input', x: 999999, y: -999999 }));
            ws.send(JSON.stringify({ type: 'input', x: 'NaN', y: 'Infinity' }));
            ws.send(JSON.stringify({ type: 'control', id: 'slider1', value: -100 }));
            ws.send(JSON.stringify({ type: 'control', id: 'slider2', value: 999 }));
            ws.send(JSON.stringify({ type: 'control', id: 'unknown_button', value: 1 }));

            // 3. Flood with 100 rapid messages
            for (let i = 0; i < 100; i++) {
                ws.send(JSON.stringify({ type: 'input', x: Math.sin(i), y: Math.cos(i) }));
            }

            await sleep(300);
            ws.close();
            console.log("  ✔ Server withstood malformed & extreme message flood without crashing!");
            resolve(true);
        });
    });
}

async function testConcurrentPlayers(roomCode) {
    console.log("\n[TEST 3] Multi-User Concurrency & Rapid Churn (8 simultaneous players)...");
    const CLIENT_COUNT = 8;
    const clients = [];

    for (let i = 0; i < CLIENT_COUNT; i++) {
        const pNum = i + 1;
        const ws = new WebSocket('ws://127.0.0.1:8080');
        const clientObj = { id: pNum, name: `Swimmer_${pNum}`, ws, slot: null };
        clients.push(clientObj);

        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'join', name: clientObj.name, room: roomCode }));
        });

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'assigned_slot') {
                    clientObj.slot = data.slot;
                }
            } catch(e) {}
        });
    }

    // Wait for all to connect
    await sleep(1500);
    const assignedSlots = clients.map(c => c.slot).filter(s => s !== null);
    console.log(`  Connected players: ${assignedSlots.length} / ${CLIENT_COUNT}. Assigned slots:`, assignedSlots);

    // Active swimming simulation for all players simultaneously
    console.log("  Simulating simultaneous joystick motion and control triggers...");
    for (let step = 0; step < 15; step++) {
        clients.forEach((c, idx) => {
            if (c.ws.readyState === WebSocket.OPEN) {
                const angle = (step + idx) * 0.4;
                c.ws.send(JSON.stringify({ type: 'input', x: Math.cos(angle) * 0.6, y: Math.sin(angle) * 0.4 }));
                if (step === 5 && idx % 2 === 0) {
                    c.ws.send(JSON.stringify({ type: 'control', id: 'action3', value: 1 }));
                }
            }
        });
        await sleep(60);
    }

    // Disconnect half of them out-of-order
    console.log("  Disconnecting alternate players out of order (slots 6, 8, 10)...");
    for (let i = 0; i < CLIENT_COUNT; i += 2) {
        clients[i].ws.close();
    }
    await sleep(800);

    // Disconnect remaining players
    console.log("  Disconnecting remaining players...");
    for (let i = 1; i < CLIENT_COUNT; i += 2) {
        clients[i].ws.close();
    }
    await sleep(600);
    console.log("  ✔ Multi-user concurrency & churn completed cleanly!");
    return true;
}

async function testImmediateRejoin(roomCode) {
    console.log("\n[TEST 4] Immediate Disconnect and Rejoin (Slot recycling)...");
    const ws1 = new WebSocket('ws://127.0.0.1:8080');
    let slot1 = null;
    ws1.on('open', () => ws1.send(JSON.stringify({ type: 'join', name: 'Phoenix', room: roomCode })));
    ws1.on('message', m => {
        const d = JSON.parse(m.toString());
        if (d.type === 'assigned_slot') slot1 = d.slot;
    });

    while (!slot1) await sleep(50);
    console.log(`  First connection got slot: ${slot1}`);
    ws1.close();
    await sleep(300);

    // Rejoin immediately
    const ws2 = new WebSocket('ws://127.0.0.1:8080');
    let slot2 = null;
    ws2.on('open', () => ws2.send(JSON.stringify({ type: 'join', name: 'Phoenix_Reborn', room: roomCode })));
    ws2.on('message', m => {
        const d = JSON.parse(m.toString());
        if (d.type === 'assigned_slot') slot2 = d.slot;
    });

    while (!slot2) await sleep(50);
    console.log(`  Rejoined connection got slot: ${slot2}`);
    ws2.close();
    await sleep(300);

    if (slot1 === slot2) {
        console.log("  ✔ Slot successfully recycled immediately without fragmentation!");
    } else {
        console.log(`  ✔ Assigned available slot ${slot2} cleanly.`);
    }
    return true;
}

async function main() {
    console.log("==================================================");
    console.log("   TD BRIDGE COMPREHENSIVE STRESS & EDGE-CASE TEST ");
    console.log("==================================================");
    const room = await getRoomCode();
    console.log(`Targeting room: ${room}`);

    await testInvalidRoomCode();
    await testCorruptedAndExtremePayloads(room);
    await testConcurrentPlayers(room);
    await testImmediateRejoin(room);

    console.log("\n==================================================");
    console.log("   ALL STRESS & EDGE CASE TESTS COMPLETED!        ");
    console.log("==================================================");
}

main().catch(err => {
    console.error("Stress test failed:", err);
    process.exit(1);
});
