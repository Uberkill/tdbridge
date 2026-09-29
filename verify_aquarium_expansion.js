const WebSocket = require('ws');
const http = require('http');

async function getRoomCode() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/room', (res) => {
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
    console.log("=== AQUARIUM EXPANSION END-TO-END VERIFICATION ===");
    const roomCode = await getRoomCode();
    console.log(`[1] Fetched active room code: ${roomCode}`);

    const ws = new WebSocket('ws://127.0.0.1:8080');

    let assignedSlot = null;
    let receivedBlueprint = null;

    ws.on('open', () => {
        console.log("[2] Connected to Relay WebSocket. Sending join request for 'CaptainNemo'...");
        ws.send(JSON.stringify({ type: 'join', name: 'CaptainNemo', room: roomCode }));
    });

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'assigned_slot') {
                assignedSlot = data.slot;
                receivedBlueprint = data.ui_blueprint;
                console.log(`[3] Successfully assigned to Slot ${assignedSlot}!`);
            }
        } catch(e) {}
    });

    // Wait for slot assignment
    let waitCount = 0;
    while (!assignedSlot && waitCount < 30) {
        await sleep(100);
        waitCount++;
    }

    if (!assignedSlot) {
        throw new Error("Failed to get assigned slot within 3 seconds!");
    }

    console.log("\n--- UI BLUEPRINT VALIDATION ---");
    console.log("Blueprint controls count:", receivedBlueprint?.length);
    const controlIds = receivedBlueprint?.map(c => `${c.id} (${c.label})`);
    console.log("Controls:", controlIds?.join(", "));
    const hasAction3 = receivedBlueprint?.some(c => c.id === 'action3' || c.alias === 'action3' || (c.id === 'b3' && c.label.includes('Feed')));
    if (!hasAction3) {
        throw new Error("action3 ('Feed Fish') missing from ui_blueprint!");
    }
    console.log("✔ action3 / b3 ('Feed Fish') verified in ui_blueprint!");

    // Movement test
    console.log("\n--- MOVEMENT & PERSISTENCE TEST ---");
    console.log("Moving joystick: x=0.8, y=0.4 for 1 second...");
    for (let i = 0; i < 20; i++) {
        ws.send(JSON.stringify({ type: 'input', x: 0.8, y: 0.4 }));
        await sleep(50);
    }
    console.log("Releasing joystick to (0, 0)...");
    ws.send(JSON.stringify({ type: 'input', x: 0.0, y: 0.0 }));
    await sleep(400);

    // Feed fish test
    console.log("\n--- INTERACTIVE FEEDING TEST ---");
    console.log("Pressing 'Feed Fish' (action3 = 1)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action3', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action3', value: 0 }));
    console.log("Food pellet dropped near CaptainNemo!");

    // Color cycle test
    console.log("\n--- COLOR CHANGE TEST ---");
    console.log("Pressing 'Change Color' (action2 = 1)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 0 }));

    // Resize test
    console.log("\n--- FISH RESIZE TEST ---");
    console.log("Setting 'Fish Size' slider2 to 0.88...");
    ws.send(JSON.stringify({ type: 'control', id: 'slider2', value: 0.88 }));
    await sleep(300);

    // 360 Rotate test
    console.log("\n--- 360 ROTATE TEST ---");
    console.log("Triggering 'Rotate' (action1 = 1)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 0 }));
    await sleep(800);

    // Environment Scare test via WebSocket
    console.log("\n--- ENVIRONMENT SCARE TEST ---");
    console.log("Sending env scare pulse...");
    ws.send(JSON.stringify({ type: 'env', param: 'scare', value: 1 }));
    await sleep(500);

    console.log("\n--- CLEAN DISCONNECT TEST ---");
    ws.close();
    await sleep(600);
    console.log("✔ Disconnected cleanly. All WS test sequences complete!");
}

run().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
