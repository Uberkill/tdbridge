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

async function runScenario() {
    console.log("=== STARTING INTERACTIVE PLAYER SCENARIO TEST ===");
    
    // 1. Fetch Room Code
    const roomCode = await getRoomCode();
    console.log(`[STEP 1] Fetched Active Room Code: ${roomCode}`);

    // 2. Connect WebSocket
    const ws = new WebSocket('ws://127.0.0.1:8080');
    let assignedSlot = -1;
    let joined = false;

    ws.on('open', () => {
        console.log("[STEP 2] WebSocket connected to relay.");
        ws.send(JSON.stringify({ type: 'join', role: 'performer', name: 'Sharky', room: roomCode }));
    });

    ws.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.type === 'assigned_slot') {
            assignedSlot = data.slot;
            console.log(`[STEP 2] Server assigned slot: ${assignedSlot}`);
            console.log(`[STEP 2] Received UI Blueprint with ${data.ui_blueprint.length} controls:`, 
                data.ui_blueprint.map(c => `${c.id} (${c.label})`));
            joined = true;
        }
    });

    // Wait for join
    while (!joined) {
        await sleep(100);
    }
    await sleep(500); // Wait for TD replicator to cook

    console.log("\n[STEP 3] Moving Joystick Left and Up (x = -0.85, y = 0.5)...");
    const moveDuration = 1000;
    const interval = 33;
    const startTime = Date.now();

    while (Date.now() - startTime < moveDuration) {
        ws.send(JSON.stringify({ type: 'input', x: -0.85, y: 0.5 }));
        await sleep(interval);
    }

    console.log("[STEP 4] Releasing Joystick to Neutral (x = 0, y = 0)...");
    ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));

    console.log("[STEP 5] Waiting 1.5 seconds to test for Snap-Back / Reversion...");
    await sleep(1500);

    // 6. Test Rotate Button (Action 1)
    console.log("\n[STEP 6] Pressing Rotate 360° Button (action1)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action1', value: 0 }));
    await sleep(600); // Allow spin animation to complete

    // 7. Test Color Button (Action 2)
    console.log("\n[STEP 7] Pressing Change Color Button (action2)...");
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 1 }));
    await sleep(100);
    ws.send(JSON.stringify({ type: 'control', id: 'action2', value: 0 }));
    await sleep(300);

    console.log("\n[STEP 8] Keeping session alive for TouchDesigner inspection & screenshot...");
    await sleep(2000);

    console.log("[STEP 9] Closing session (testing disconnect cleanup)...");
    ws.close();
    await sleep(500);
    console.log("=== SCENARIO TEST COMPLETED SUCCESSFULLY ===");
}

runScenario().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
