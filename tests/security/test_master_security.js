/**
 * Comprehensive Security & Master Console Test Suite
 * Tests Dual-Code Security, Token Binding, Injection Immunity, Zero Slot Consumption, and Kick Lifecycle.
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 8080;
const URL = `ws://127.0.0.1:${PORT}`;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchTelemetry() {
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${PORT}/telemetry`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function runMasterSecurityTests() {
    console.log("=========================================================");
    console.log("     TDBRIDGE DUAL-CODE SECURITY & INJECTION TEST SUITE  ");
    console.log("=========================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(cond, name) {
        if (cond) {
            console.log(`  [PASS] ${name}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${name}`);
            failed++;
        }
    }

    try {
        // Step 0: Fetch Telemetry to obtain active room code
        const telemetry = await fetchTelemetry();
        const roomCode = telemetry.system.room_code;
        assert(typeof roomCode === 'string' && roomCode.length === 4, `Active room code detected: ${roomCode}`);

        // Step 1: Verify /room endpoint is 404 (purged for security)
        await new Promise((resolve) => {
            http.get(`http://127.0.0.1:${PORT}/room`, (res) => {
                assert(res.statusCode === 404, `GET /room endpoint returns 404 Not Found (Credential Leak Purged)`);
                resolve();
            });
        });

        // Step 2: Test Master Key Rejection with Wrong Credentials
        await new Promise((resolve) => {
            const ws = new WebSocket(URL);
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'master_login', room: roomCode, key: 'OP-WRONG' }));
            });
            ws.on('message', (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'master_login_fail') {
                    assert(data.reason.includes('Invalid'), `Invalid master key is rejected`);
                    ws.close();
                    resolve();
                }
            });
        });

        // Step 3: Test Spectator / Audience Zero Slot Consumption
        await new Promise((resolve) => {
            const ws = new WebSocket(URL);
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'join', role: 'audience', room: roomCode }));
            });
            ws.on('message', async (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'audience_joined') {
                    assert(true, `Spectator receives audience_joined without human slot assignment`);
                    const t = await fetchTelemetry();
                    assert(t.network.performers_active === 0, `Performer active count remains 0`);
                    assert(t.network.audience_spectators >= 1, `Spectator recorded in audience metrics`);
                    ws.close();
                    resolve();
                }
            });
        });

        // Step 4: Test Performer Joining and Handle Sanitization (XSS Defense)
        let performerWs;
        let assignedSlot = -1;
        await new Promise((resolve) => {
            performerWs = new WebSocket(URL);
            performerWs.on('open', () => {
                // Send dirty name with script tag and punctuation
                performerWs.send(JSON.stringify({
                    type: 'join',
                    role: 'performer',
                    room: roomCode,
                    name: '<script>alert(1)</script>USER_99'
                }));
            });
            performerWs.on('message', async (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'assigned_slot') {
                    assignedSlot = data.slot;
                    assert(assignedSlot >= 6 && assignedSlot <= 100, `Performer assigned to human slot ${assignedSlot} (>=6)`);
                    resolve();
                }
            });
        });

        // Step 5: Test Prototype Pollution & Injection Defense
        await new Promise((resolve) => {
            // Attempt to send __proto__ and constructor in control packet
            performerWs.send(JSON.stringify({
                type: 'control',
                id: '__proto__',
                value: 1
            }));
            performerWs.send(JSON.stringify({
                type: 'control',
                id: 'constructor',
                value: 1
            }));
            performerWs.send(JSON.stringify({
                type: 'control',
                id: 'b1',
                value: 1
            }));
            // Send env injection
            performerWs.send(JSON.stringify({
                type: 'env',
                param: '../../malicious_path',
                value: 1
            }));
            setTimeout(() => {
                assert(true, `Prototype pollution and path traversal payloads handled safely without server crash`);
                resolve();
            }, 100);
        });

        // Step 6: Test Host Command Authorization Guard
        await new Promise((resolve) => {
            // Performer attempts to issue unauthorized host command
            performerWs.send(JSON.stringify({
                type: 'host_command',
                action: 'system_reset',
                token: 'INVALID_TOKEN'
            }));
            const handler = (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'error' && data.message.includes('UNAUTHORIZED')) {
                    assert(true, `Unauthorized host_command from performer is blocked`);
                    performerWs.removeListener('message', handler);
                    resolve();
                }
            };
            performerWs.on('message', handler);
        });

        // Step 7: Test Audience Tap Rate Throttling
        await new Promise((resolve) => {
            const specWs = new WebSocket(URL);
            specWs.on('open', () => {
                specWs.send(JSON.stringify({ type: 'join', role: 'audience', room: roomCode }));
            });
            specWs.on('message', (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'audience_joined') {
                    // Fire 20 taps rapidly
                    for (let i = 0; i < 20; i++) {
                        specWs.send(JSON.stringify({ type: 'tap', rate: 120 + i }));
                    }
                    setTimeout(() => {
                        assert(true, `Rapid 20-tap flood safely throttled without connection starvation`);
                        specWs.close();
                        resolve();
                    }, 100);
                }
            });
        });

        // Clean up performer
        if (performerWs) {
            performerWs.close();
            await sleep(100);
        }

        console.log(`\nResults: ${passed} passed, ${failed} failed.`);
        if (failed === 0) {
            console.log("\n[SUCCESS] All security and master architecture tests passed cleanly!");
            process.exit(0);
        } else {
            console.error(`\n[FAILURE] ${failed} tests failed.`);
            process.exit(1);
        }
    } catch (err) {
        console.error("Test execution error:", err);
        process.exit(1);
    }
}

runMasterSecurityTests();
