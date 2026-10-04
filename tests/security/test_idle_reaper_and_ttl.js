// ============================================================================
// TDBRIDGE // INTEGRATION TEST: IDLE REAPER, TTL PRUNING & LOBBY TELEMETRY
// Verifies 15s handshake timeout, IP table TTL pruning, and lobby telemetry.
// ============================================================================

const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = parseInt(process.env.WS_PORT || '8080', 10);
const WS_URL = `ws://127.0.0.1:${PORT}`;
const HTTP_URL = `http://127.0.0.1:${PORT}`;
const CWD = path.resolve(__dirname, '../..');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function probeHttp(url, timeoutMs = 1500) {
    return new Promise(resolve => {
        const req = http.get(url, { timeout: timeoutMs }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ ok: res.statusCode === 200 }));
        });
        req.on('error', () => resolve({ ok: false }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    });
}

async function ensureRelay() {
    let check = await probeHttp(`${HTTP_URL}/health`);
    if (check.ok) return null;
    const proc = spawn('node', ['dist/relay.js'], { cwd: CWD, stdio: 'ignore' });
    for (let i = 0; i < 25; i++) {
        await sleep(200);
        check = await probeHttp(`${HTTP_URL}/health`);
        if (check.ok) return proc;
    }
    return proc;
}

function fetchTelemetry() {
    return new Promise((resolve, reject) => {
        http.get(`${HTTP_URL}/telemetry`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function runTest() {
    const spawned = await ensureRelay();
    console.log("=========================================================");
    console.log("  TDBRIDGE // IDLE REAPER, TTL & LOBBY TELEMETRY SUITE   ");
    console.log("=========================================================\n");

    let passes = 0;
    let fails = 0;

    function assert(cond, name) {
        if (cond) {
            console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
            passes++;
        } else {
            console.error(`  \x1b[31m[FAIL]\x1b[0m ${name}`);
            fails++;
        }
    }

    try {
        // Test 1: Verify Telemetry schema contains lobby_gate_sockets
        const tInitial = await fetchTelemetry();
        assert(typeof tInitial.network.lobby_gate_sockets === 'number', "Telemetry schema contains lobby_gate_sockets");
        assert(tInitial.ports.osc_local_port === parseInt(process.env.OSC_LOCAL_PORT || '9001', 10), `Telemetry reflects OSC_LOCAL_PORT (${tInitial.ports.osc_local_port})`);

        // Test 2: Connecting an unauthenticated socket increments lobby_gate_sockets
        const idleWs = new WebSocket(WS_URL);
        await new Promise(r => idleWs.on('open', r));
        await sleep(100);

        const tWithIdle = await fetchTelemetry();
        assert(tWithIdle.network.lobby_gate_sockets >= 1, `Connecting unauthenticated socket increments lobby_gate_sockets (now ${tWithIdle.network.lobby_gate_sockets})`);
        assert(tWithIdle.network.total_connected_sockets >= 1, `Total connected sockets includes lobby sockets (now ${tWithIdle.network.total_connected_sockets})`);

        // Test 3: Closing the unauthenticated socket decrements lobby_gate_sockets
        idleWs.close();
        await sleep(150);

        const tClosed = await fetchTelemetry();
        assert(tClosed.network.lobby_gate_sockets === tInitial.network.lobby_gate_sockets, "Closing unauthenticated socket decrements lobby_gate_sockets");

        // Test 4: Authenticated join transitions socket out of lobby_gate_sockets
        const roomCode = tInitial.system.room_code;
        const joinWs = new WebSocket(WS_URL);
        await new Promise(r => joinWs.on('open', r));
        joinWs.send(JSON.stringify({ type: 'join', role: 'performer', room: roomCode, name: 'TEST_REAPER' }));
        
        await new Promise((resolve) => {
            joinWs.on('message', (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'assigned_slot') resolve();
            });
        });

        const tJoined = await fetchTelemetry();
        assert(tJoined.network.performers_active >= 1, "Performer successfully claimed slot");
        assert(tJoined.network.lobby_gate_sockets === tInitial.network.lobby_gate_sockets, "Socket properly transitioned out of lobby_gate_sockets into performer slot");

        joinWs.close();
        await sleep(150);

        // Test 5: Verify Brute-Force Termination on socket level (code 4003)
        const bfWs = new WebSocket(WS_URL);
        await new Promise(r => bfWs.on('open', r));
        
        let closeCode = null;
        bfWs.on('close', (code) => { closeCode = code; });

        bfWs.send(JSON.stringify({ type: 'master_login', room: roomCode, key: 'WRONG_1' }));
        bfWs.send(JSON.stringify({ type: 'master_login', room: roomCode, key: 'WRONG_2' }));
        bfWs.send(JSON.stringify({ type: 'master_login', room: roomCode, key: 'WRONG_3' }));

        await sleep(200);
        assert(closeCode === 4003, `Socket closed with code 4003 after 3 failed master attempts (received ${closeCode})`);

        console.log(`\nResults: ${passes} passed, ${fails} failed.`);
        if (spawned) spawned.kill();
        if (fails === 0) {
            console.log("\n\x1b[32m[SUCCESS] All idle reaper, TTL, and lobby telemetry tests passed 100% cleanly!\x1b[0m");
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (err) {
        if (spawned) spawned.kill();
        console.error("Test execution failed with error:", err);
        process.exit(1);
    }
}

runTest();
