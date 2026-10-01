/**
 * Full Master Lifecycle & Kick Test
 * Listens on OSC 9000 for /bridge/master_code, authenticates as Master,
 * verifies roster synchronization, kicks performer, and confirms kick.
 */

const WebSocket = require('ws');
const dgram = require('dgram');
const http = require('http');

const WS_URL = 'ws://127.0.0.1:8080';

async function fetchTelemetry() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/telemetry', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function parseOscString(buf) {
    const str = buf.toString('utf-8');
    const match = str.match(/\/bridge\/master_code[^\x00]*\x00+,s\x00+([A-Z0-9-]+)/);
    if (match) return match[1];
    // Fallback search
    const opMatch = str.match(/(OP-\d{6})/);
    if (opMatch) return opMatch[1];
    return null;
}

async function run() {
    console.log("=== Testing Full Master Lifecycle & Kick Workflow ===");

    // 1. Get room code
    const t = await fetchTelemetry();
    const roomCode = t.system.room_code;
    console.log(`[1] Detected Active Room Code: ${roomCode}`);

    // 2. Listen on UDP 9000 to intercept /bridge/master_code
    console.log("[2] Intercepting /bridge/master_code on localhost UDP 9000...");
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

    // 3. Connect Performer
    console.log("[3] Connecting Performer (Slot 6)...");
    const performerWs = new WebSocket(WS_URL);
    let assignedSlot = -1;
    await new Promise((resolve) => {
        performerWs.on('open', () => {
            performerWs.send(JSON.stringify({
                type: 'join',
                role: 'performer',
                room: roomCode,
                name: 'TEST_PERF_1',
                color_hex: '#00f0ff'
            }));
        });
        performerWs.on('message', (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.type === 'assigned_slot') {
                assignedSlot = data.slot;
                console.log(`[3] Performer assigned slot #${assignedSlot}`);
                resolve();
            }
        });
    });

    // 4. Connect Master Console & Authenticate
    console.log("[4] Authenticating FOH Master Console...");
    const masterWs = new WebSocket(WS_URL);
    let masterToken = '';
    await new Promise((resolve) => {
        masterWs.on('open', () => {
            masterWs.send(JSON.stringify({
                type: 'master_login',
                room: roomCode,
                key: masterKey
            }));
        });
        masterWs.on('message', (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.type === 'master_login_success') {
                masterToken = data.token;
                console.log(`[4] Master authenticated successfully! Session token: ${masterToken.substring(0, 8)}...`);
                resolve();
            }
        });
    });

    // 5. Verify Roster Reception
    console.log("[5] Waiting for Roster Update on Master Console...");
    await new Promise((resolve) => {
        const handler = (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.type === 'roster_update') {
                const found = data.performers.find(p => p.slot === assignedSlot);
                if (found) {
                    console.log(`[5] Roster verified: Slot ${found.slot} (${found.name}) active with color ${found.color}`);
                    masterWs.removeListener('message', handler);
                    resolve();
                }
            }
        };
        masterWs.on('message', handler);
    });

    // 6. Master kicks performer
    console.log(`[6] Master issuing kick_slot for Slot ${assignedSlot}...`);
    let performerKicked = false;
    performerWs.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.type === 'kicked') {
            console.log(`[6] Performer received kicked event: ${data.reason}`);
            performerKicked = true;
        }
    });

    await new Promise((resolve) => {
        performerWs.on('close', (code, reason) => {
            console.log(`[6] Performer socket closed with code ${code}`);
            resolve();
        });

        masterWs.send(JSON.stringify({
            type: 'host_command',
            action: 'kick_slot',
            slot: assignedSlot,
            token: masterToken
        }));
    });

    if (performerKicked) {
        console.log("[PASS] Kick lifecycle verified successfully!");
    } else {
        console.error("[FAIL] Performer did not receive kick event");
        process.exit(1);
    }

    // Clean up
    masterWs.close();
    console.log("\n[SUCCESS] Full Master Lifecycle, Authentication & Remote Kick Test Passed 100%!");
    process.exit(0);
}

run().catch(err => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
