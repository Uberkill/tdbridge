const WebSocket = require('ws');
const http = require('http');
const dgram = require('dgram');

function parseOscString(buf) {
    const str = buf.toString('utf-8');
    const match = str.match(/\/bridge\/master_code[^\x00]*\x00+,s\x00+([A-Z0-9-]+)/);
    if (match) return match[1];
    const opMatch = str.match(/(OP-\d{6})/);
    if (opMatch) return opMatch[1];
    return null;
}

async function getTelemetry() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/telemetry', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function waitForTelemetry(expectedScene, expectedProfile) {
    for (let i = 0; i < 20; i++) {
        const t = await getTelemetry();
        if (t.system.active_scene === expectedScene && t.system.active_profile === expectedProfile) {
            return t;
        }
        await new Promise(r => setTimeout(r, 100));
    }
    const finalT = await getTelemetry();
    throw new Error(`Telemetry did not reflect ${expectedScene}/${expectedProfile}! Got: ${finalT.system.active_scene}/${finalT.system.active_profile}`);
}

async function runTest() {
    console.log("====================================================================");
    console.log("   TDBRIDGE HYBRID MULTI-SCENE & PARTICLE CANVAS VERIFICATION BATTERY");
    console.log("====================================================================");

    const telemetry = await getTelemetry();
    const room = telemetry.system.room_code;
    console.log(`[1] Active Room Code: ${room}`);

    // Intercept Master Key on UDP 9000
    console.log("[2] Intercepting /bridge/master_code on UDP 9000...");
    const oscServer = dgram.createSocket('udp4');
    const masterKey = await new Promise((resolve) => {
        oscServer.on('message', (msg) => {
            const key = parseOscString(msg);
            if (key) {
                console.log(`[2] Intercepted Master Key: ${key}`);
                oscServer.close();
                resolve(key);
            }
        });
        oscServer.bind(9000, '127.0.0.1');
    });

    // --- STEP 1: Connect Master Console WebSocket ---
    const masterWs = new WebSocket(`ws://127.0.0.1:8080`);
    await new Promise((resolve) => masterWs.on('open', resolve));

    masterWs.send(JSON.stringify({
        type: 'master_login',
        room: room,
        key: masterKey
    }));

    let sessionToken = '';
    let initialScene = '';
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Master login timeout')), 4000);
        masterWs.on('message', (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'master_login_success') {
                sessionToken = msg.token;
                initialScene = msg.active_scene;
                clearTimeout(timeout);
                resolve();
            }
        });
    });

    console.log(`[3] Master authenticated! Token: ${sessionToken.substring(0, 8)}... Initial Scene: ${initialScene}`);
    console.log(`✔ [PASS] Initial scene state is ${initialScene}.`);

    // --- STEP 2: Switch to Particle Canvas ---
    console.log(`\n--- TEST 1: Switch Scene to 'canvas' ---`);
    let sceneSwitchedPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Scene switch timeout for canvas')), 4000);
        const listener = (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'scene_switched' && msg.scene === 'canvas') {
                masterWs.removeListener('message', listener);
                clearTimeout(timeout);
                resolve(msg);
            }
        };
        masterWs.on('message', listener);
    });

    masterWs.send(JSON.stringify({
        type: 'host_command',
        token: sessionToken,
        action: 'scene_switch',
        scene: 'canvas'
    }));

    const canvasMsg = await sceneSwitchedPromise;
    console.log(`✔ [PASS] Received scene_switched broadcast: scene=${canvasMsg.scene}, profile=${canvasMsg.profile}`);

    const tCanvas = await waitForTelemetry('canvas', 'touchpad');
    console.log(`Telemetry State: scene=${tCanvas.system.active_scene}, profile=${tCanvas.system.active_profile}`);
    console.log(`✔ [PASS] Server & TouchDesigner synchronized to canvas / touchpad!`);

    // --- STEP 3: Late-Joiner Handshake ---
    console.log(`\n--- TEST 2: Late-Joiner Handshake Sync ---`);
    const performerWs = new WebSocket(`ws://127.0.0.1:8080`);
    await new Promise(r => performerWs.on('open', r));

    performerWs.send(JSON.stringify({
        type: 'join',
        role: 'performer',
        room: room,
        name: 'LateJoiner'
    }));

    const performerAssigned = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Performer join timeout')), 4000);
        performerWs.on('message', (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'assigned_slot') {
                clearTimeout(timeout);
                resolve(msg);
            }
        });
    });

    console.log(`Late-Joiner assigned: slot=${performerAssigned.slot}, scene=${performerAssigned.active_scene}, profile=${performerAssigned.profile}`);
    if (performerAssigned.active_scene !== 'canvas' || performerAssigned.profile !== 'touchpad') {
        throw new Error(`Late joiner did not receive canvas state! Got: ${JSON.stringify(performerAssigned)}`);
    }
    console.log(`✔ [PASS] Late-joining client correctly received scene='canvas' and profile='touchpad'!`);

    // --- STEP 4: Switch to QR Banner ---
    console.log(`\n--- TEST 3: Switch Scene to 'qr' (QR Banner) ---`);
    let qrSwitchedPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Scene switch timeout for qr')), 4000);
        const listener = (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'scene_switched' && msg.scene === 'qr') {
                masterWs.removeListener('message', listener);
                clearTimeout(timeout);
                resolve(msg);
            }
        };
        masterWs.on('message', listener);
    });

    masterWs.send(JSON.stringify({
        type: 'host_command',
        token: sessionToken,
        action: 'scene_switch',
        scene: 'qr'
    }));

    const qrMsg = await qrSwitchedPromise;
    console.log(`✔ [PASS] Received scene_switched broadcast: scene=${qrMsg.scene}, profile=${qrMsg.profile}`);

    const tQr = await waitForTelemetry('qr', 'audience');
    console.log(`Telemetry State: scene=${tQr.system.active_scene}, profile=${tQr.system.active_profile}`);
    console.log(`✔ [PASS] Server & TouchDesigner synchronized to qr / audience!`);

    // --- STEP 5: Switch back to Aquarium ---
    console.log(`\n--- TEST 4: Switch Scene back to 'aquarium' ---`);
    let aqSwitchedPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Scene switch timeout for aquarium')), 4000);
        const listener = (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'scene_switched' && msg.scene === 'aquarium') {
                masterWs.removeListener('message', listener);
                clearTimeout(timeout);
                resolve(msg);
            }
        };
        masterWs.on('message', listener);
    });

    masterWs.send(JSON.stringify({
        type: 'host_command',
        token: sessionToken,
        action: 'scene_switch',
        scene: 'aquarium'
    }));

    const aqMsg = await aqSwitchedPromise;
    console.log(`✔ [PASS] Received scene_switched broadcast: scene=${aqMsg.scene}, profile=${aqMsg.profile}`);

    const tAq = await waitForTelemetry('aquarium', 'gamepad');
    console.log(`Telemetry State: scene=${tAq.system.active_scene}, profile=${tAq.system.active_profile}`);
    console.log(`✔ [PASS] Server & TouchDesigner reset to aquarium / gamepad!`);

    // Teardown
    performerWs.close();
    masterWs.close();

    console.log("\n====================================================================");
    console.log("   ALL MULTI-SCENE & PARTICLE CANVAS TESTS PASSED 100% CLEANLY!    ");
    console.log("====================================================================");
}

runTest().catch(err => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});
