// ============================================================================
// TDBRIDGE // TELEMETRY & PORT HYGIENE INTEGRATION TEST
// Verifies 4-domain observability, client error beacons, and system contracts.
// ============================================================================

const WebSocket = require('ws');
const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:8080';
const WS_URL = 'ws://127.0.0.1:8080';

async function runTests() {
    console.log("=========================================================");
    console.log("  TDBRIDGE // TELEMETRY & PORT HYGIENE ACCEPTANCE SUITE  ");
    console.log("=========================================================\n");

    let passes = 0;
    let failures = 0;

    async function test(name, fn) {
        try {
            process.stdout.write(`[*] Testing ${name}... `);
            await fn();
            console.log("\x1b[32mPASSED\x1b[0m");
            passes++;
        } catch (e) {
            console.log("\x1b[31mFAILED\x1b[0m");
            console.error(`    Error: ${e.message}`);
            failures++;
        }
    }

    // 1. Health check
    await test("GET /health Endpoint", async () => {
        const res = await fetch(`${BASE_URL}/health`);
        assert.strictEqual(res.status, 200, "Expected status 200");
        const json = await res.json();
        assert.strictEqual(json.status, 'ok');
        assert(typeof json.uptime === 'number' && json.uptime >= 0);
        assert(typeof json.room === 'string' && json.room.length === 4);
    });

    // 2. Telemetry Schema Validation
    let roomCode = '';
    await test("GET /telemetry 4-Domain Schema", async () => {
        const res = await fetch(`${BASE_URL}/telemetry`);
        assert.strictEqual(res.status, 200, "Expected status 200");
        const t = await res.json();

        // System domain
        assert(t.system, "Missing system domain");
        assert(['healthy', 'degraded'].includes(t.system.status));
        assert(typeof t.system.pid === 'number' && t.system.pid > 0);
        assert(typeof t.system.memory_rss_mb === 'number');
        assert(typeof t.system.room_code === 'string' && t.system.room_code.length === 4);
        roomCode = t.system.room_code;

        // Ports domain
        assert(t.ports, "Missing ports domain");
        assert.strictEqual(t.ports.http_ws_port, 8080);
        assert.strictEqual(t.ports.osc_remote_port, 9000);
        assert.strictEqual(t.ports.osc_local_port, 9001);
        assert.strictEqual(t.ports.is_listening, true);

        // TouchDesigner domain
        assert(t.touchdesigner, "Missing touchdesigner domain");
        assert.strictEqual(typeof t.touchdesigner.is_connected, 'boolean');
        assert.strictEqual(typeof t.touchdesigner.cook_fps, 'number');
        if (t.touchdesigner.is_connected) {
            assert(t.touchdesigner.cook_fps > 0, "Expected cook_fps > 0 when connected");
        } else {
            assert(t.touchdesigner.cook_fps >= 0, "Expected cook_fps >= 0");
        }

        // Network domain
        assert(t.network, "Missing network domain");
        assert(typeof t.network.public_url === 'string');
        assert(typeof t.network.total_connected_sockets === 'number');
        assert(typeof t.network.average_client_rtt_ms === 'number');

        // Recent events ring buffer
        assert(Array.isArray(t.recent_events), "recent_events must be an array");
    });

    // 3. Client Exception Beaconing
    await test("Client Error Beacon Forwarding into Telemetry", async () => {
        const ws = new WebSocket(WS_URL);
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });

        const testErrorMsg = `Simulated Client Crash [${Date.now()}]`;
        ws.send(JSON.stringify({
            type: 'client_telemetry_error',
            message: testErrorMsg,
            line: 42,
            col: 10,
            stack: 'TypeError: Cannot read property of null\n    at HTMLButtonElement.press (app.ts:42:10)'
        }));

        // Allow relay event loop to process
        await new Promise(r => setTimeout(r, 200));

        const res = await fetch(`${BASE_URL}/telemetry`);
        const t = await res.json();
        const found = t.recent_events.some(ev => ev.message && ev.message.includes(testErrorMsg));
        ws.close();
        assert(found, `Event log did not contain error beacon: ${testErrorMsg}`);
    });

    // 4. Client Real RTT Telemetry
    await test("Client RTT Telemetry Aggregation", async () => {
        const ws = new WebSocket(WS_URL);
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });

        // Join as performer
        ws.send(JSON.stringify({
            type: 'join',
            name: 'TELEMETRY_BOT',
            room: roomCode,
            color_hex: '#00f0ff'
        }));

        // Wait for assignment
        await new Promise(r => setTimeout(r, 200));

        // Send ping with reported RTT
        const pingTime = Date.now();
        ws.send(JSON.stringify({
            type: 'ping',
            t: pingTime,
            rtt: 24.5,
            fps: 60.0
        }));

        // Wait for pong
        await new Promise(resolve => {
            ws.on('message', data => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'pong') resolve(msg);
            });
        });

        const res = await fetch(`${BASE_URL}/telemetry`);
        const t = await res.json();
        assert.strictEqual(t.network.average_client_rtt_ms, 24.5, "average_client_rtt_ms mismatch");
        assert(t.network.performers_active >= 1, "Expected at least 1 active performer");

        ws.close();
        await new Promise(r => setTimeout(r, 200));

        // After close, performer count must decrement
        const resAfter = await fetch(`${BASE_URL}/telemetry`);
        const tAfter = await resAfter.json();
        assert.strictEqual(tAfter.network.performers_active, 0, "performers_active did not decrement to 0");
    });

    console.log(`\nResults: ${passes} passed, ${failures} failed.`);
    if (failures > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("FATAL TEST RUN ERROR:", err);
    process.exit(1);
});
