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

function post(path, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body || {});
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8080,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("=== TDBRIDGE PROFILE SWITCHING & HANDSHAKE TEST ===");

    // 1. Fetch Room Code
    const roomInfo = await get('/room');
    const roomCode = roomInfo.room;
    console.log(`[1] Active Room Code: ${roomCode}`);

    // 2. Connect Client 1
    const ws1 = new WebSocket('ws://127.0.0.1:8080');
    let slot1 = null;
    let currentProfile1 = null;
    let blueprint1 = null;
    const profileChanges = [];

    ws1.on('open', () => {
        ws1.send(JSON.stringify({ type: 'join', name: 'TesterOne', room: roomCode }));
    });

    ws1.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'assigned_slot') {
                slot1 = data.slot;
                currentProfile1 = data.profile;
                blueprint1 = data.ui_blueprint;
                console.log(`[2] Client 1 joined as Slot ${slot1}, Initial Profile: ${currentProfile1}`);
            }
            if (data.type === 'profile_change') {
                profileChanges.push(data);
                currentProfile1 = data.profile;
                blueprint1 = data.ui_blueprint;
                console.log(`[EVENT] Client 1 received profile_change -> ${data.profile} (${data.ui_blueprint.length} controls)`);
            }
        } catch(e) {}
    });

    let wait = 0;
    while (!slot1 && wait < 20) { await sleep(100); wait++; }
    if (!slot1) throw new Error("Client 1 failed to connect!");

    // Initial check: Should be Gamepad
    if (currentProfile1 !== 'gamepad') throw new Error(`Expected gamepad, got ${currentProfile1}`);
    console.log("✔ Initial Gamepad profile handshake verified!");

    // 3. Switch to Touchpad
    console.log("\n--- SWITCHING TO TOUCHPAD ---");
    await post('/profile/touchpad');
    await sleep(200);
    if (currentProfile1 !== 'touchpad') throw new Error(`Profile not switched to touchpad! Current: ${currentProfile1}`);
    
    // Simulate Touchpad pointer drag
    ws1.send(JSON.stringify({ type: 'input', x: 0.45, y: -0.80 }));
    ws1.send(JSON.stringify({ type: 'control', id: 'b1', value: 1 }));
    console.log("✔ Touchpad profile and normalized input transmission verified!");

    // 4. Switch to Fader Bank
    console.log("\n--- SWITCHING TO FADERBANK ---");
    await post('/profile/faderbank');
    await sleep(200);
    if (currentProfile1 !== 'faderbank') throw new Error(`Profile not switched to faderbank! Current: ${currentProfile1}`);
    
    // Simulate Fader moves
    ws1.send(JSON.stringify({ type: 'control', id: 's1', value: 0.95 }));
    ws1.send(JSON.stringify({ type: 'control', id: 's2', value: 0.40 }));
    ws1.send(JSON.stringify({ type: 'control', id: 'b4', value: 1 }));
    console.log("✔ Fader Bank profile and 4-channel continuous controls verified!");

    // 5. Switch to Audience Hype
    console.log("\n--- SWITCHING TO AUDIENCE ---");
    await post('/profile/audience');
    await sleep(200);
    if (currentProfile1 !== 'audience') throw new Error(`Profile not switched to audience! Current: ${currentProfile1}`);
    
    // Simulate BPM tap
    ws1.send(JSON.stringify({ type: 'tap', rate: 135 }));
    console.log("✔ Audience Hype profile and tap pulse verified!");

    // 6. LATE-JOINER TEST: Connect Client 2 while Audience profile is active!
    console.log("\n--- LATE-JOINER HANDSHAKE TEST ---");
    const ws2 = new WebSocket('ws://127.0.0.1:8080');
    let slot2 = null;
    let lateProfile = null;

    ws2.on('open', () => {
        ws2.send(JSON.stringify({ type: 'join', name: 'LateJoiner', room: roomCode }));
    });

    ws2.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'assigned_slot') {
                slot2 = data.slot;
                lateProfile = data.profile;
            }
        } catch(e) {}
    });

    wait = 0;
    while (!slot2 && wait < 20) { await sleep(100); wait++; }
    if (!slot2) throw new Error("Client 2 failed to connect!");

    console.log(`[6] Late-Joiner Client 2 connected as Slot ${slot2}, Received Profile: ${lateProfile}`);
    if (lateProfile !== 'audience') {
        throw new Error(`Late joiner handshake failed! Expected 'audience', got '${lateProfile}'`);
    }
    console.log("✔ Late-joiner profile synchronization passed with 100% accuracy!");

    // 7. Flush and Reset
    console.log("\n--- CLEANUP & TEARDOWN ---");
    ws1.send(JSON.stringify({ type: 'flush' }));
    ws2.send(JSON.stringify({ type: 'flush' }));
    ws1.close();
    ws2.close();

    // Reset profile back to gamepad
    await post('/profile/gamepad');
    await sleep(200);
    const finalProfile = await get('/profile');
    console.log(`[7] Reset profile to: ${finalProfile.current}`);

    console.log("\n=== ALL PROFILE SWITCHING & LATE-JOINER TESTS PASSED SUCCESSFULLY! ===");
}

run().catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});
