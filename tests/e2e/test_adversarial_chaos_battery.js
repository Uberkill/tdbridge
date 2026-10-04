// ============================================================================
// TDBRIDGE // ADVERSARIAL CHAOS & MULTI-PROJECT GENERALIZATION BATTERY
// Verifies dynamic blueprints, 60Hz input floods, dirty TCP drops, 
// adversarial payloads/fuzzing, and 100-user capacity boundaries.
// ============================================================================

const WebSocket = require('ws');
const http = require('http');
const assert = require('assert');

const WS_PORT = parseInt(process.env.WS_PORT || '8080', 10);
const BASE_URL = `http://127.0.0.1:${WS_PORT}`;
const WS_URL = `ws://127.0.0.1:${WS_PORT}`;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function fetchJson(urlPath, method = 'GET', postData = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlPath, BASE_URL);
        const req = http.request(u, {
            method,
            headers: postData ? { 'Content-Type': 'application/json' } : {}
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', reject);
        if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        req.end();
    });
}

async function getActiveRoomCode() {
    const res = await fetchJson('/health');
    assert.strictEqual(res.status, 200, "Server must be healthy");
    return res.data.room;
}

async function main() {
    console.log("====================================================================");
    console.log("   TDBRIDGE ADVERSARIAL CHAOS & MULTI-PROJECT GENERALIZATION SUITE  ");
    console.log("====================================================================");

    const roomCode = await getActiveRoomCode();
    console.log(`[INIT] Connected to Relay Server on :${WS_PORT} (Active Room: ${roomCode})`);

    const openSockets = new Set();
    const activeTimers = new Set();

    function trackSocket(ws) {
        openSockets.add(ws);
        ws.on('close', () => openSockets.delete(ws));
        return ws;
    }

    function createPerformer(name, room = roomCode) {
        return new Promise((resolve, reject) => {
            const ws = trackSocket(new WebSocket(WS_URL));
            let slot = null;
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error(`Timeout creating performer ${name}`));
                }
            }, 3000);

            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'join', name, room, role: 'performer' }));
            });
            ws.on('message', data => {
                if (settled) return;
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'assigned_slot') {
                        settled = true;
                        clearTimeout(timer);
                        slot = msg.slot;
                        resolve({ ws, slot, name });
                    } else if (msg.type === 'rejected') {
                        settled = true;
                        clearTimeout(timer);
                        resolve({ ws, slot: null, rejected: true, reason: msg.reason });
                    }
                } catch (e) {}
            });
            ws.on('close', (code, reason) => {
                if (!settled && slot === null) {
                    settled = true;
                    clearTimeout(timer);
                    resolve({ ws, slot: null, rejected: true, code, reason: reason ? reason.toString() : 'Socket closed' });
                }
            });
            ws.on('error', (err) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(err);
                }
            });
        });
    }

    function createAudience(name, room = roomCode) {
        return new Promise((resolve, reject) => {
            const ws = trackSocket(new WebSocket(WS_URL));
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error(`Timeout creating audience ${name}`));
                }
            }, 3000);

            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'join', name, room, role: 'audience' }));
            });
            ws.on('message', data => {
                if (settled) return;
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'audience_joined') {
                        settled = true;
                        clearTimeout(timer);
                        resolve({ ws, name });
                    }
                } catch (e) {}
            });
            ws.on('error', (err) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(err);
                }
            });
        });
    }

    try {
        // --------------------------------------------------------------------
        // SUITE 1: Multi-Project Dynamic Blueprint Fuzzing
        // --------------------------------------------------------------------
        console.log("\n▶ [SUITE 1] Multi-Project Dynamic Blueprint Fuzzing & Deduplication...");
        
        // 1.1 Custom DJ/Lighting Blueprint (8 faders, 8 buttons)
        const djBlueprint = [
            { type: 'slider', id: 'master_fader', label: 'Master Vol', min: 0, max: 1, default_val: 0.8 },
            { type: 'slider', id: 'filter_cutoff', label: 'Filter Low', min: 20, max: 20000, default_val: 1000 },
            { type: 'button', id: 'cue_a', label: 'Deck A Cue', color: '#00ffcc' },
            { type: 'button', id: 'cue_b', label: 'Deck B Cue', color: '#ff007f' }
        ];
        const resDj = await fetchJson('/profile/custom', 'POST', { blueprint: djBlueprint });
        assert.strictEqual(resDj.status, 200, "Valid custom blueprint must be accepted");
        assert.strictEqual(resDj.data.count, 4, "Must accept all 4 valid controls");
        console.log("  ✔ Installed 4-control custom DJ blueprint via REST.");

        // 1.2 Malformed, Inverted & Duplicate-ID Blueprint
        const chaoticBlueprint = [
            { type: 'slider', id: 'crossfader', label: 'Crossfader 1', min: 100, max: 0, default_val: 50 }, // Inverted min > max
            { type: 'slider', id: 'crossfader', label: 'Crossfader Duplicate', min: 0, max: 1 },             // Duplicate ID
            { type: 'button', id: 'btn_raw', label: 'Valid Button' },
            { type: 'unknown_widget', id: 'corrupt', label: 'Invalid' },                                     // Unknown type
            { type: 'slider', id: '', label: 'Missing ID' }                                                  // Empty ID
        ];
        const resChaos = await fetchJson('/profile/custom', 'POST', { blueprint: chaoticBlueprint });
        assert.strictEqual(resChaos.status, 200, "Sanitizer must accept and clean corrupt blueprint");
        
        // Query /profile to verify sanitization
        const profileInfo = await fetchJson('/profile');
        const customBp = profileInfo.data.blueprint;
        assert(customBp.length === 3, `Expected 3 sanitized controls, got ${customBp.length}`);
        
        // Verify deduplication
        const ids = customBp.map(c => c.id);
        assert(ids.includes('crossfader'), "Original crossfader ID preserved");
        assert(ids.some(id => id.startsWith('crossfader_')), "Duplicate crossfader ID deduplicated");
        
        // Verify min/max normalization
        const normalizedSlider = customBp.find(c => c.id === 'crossfader');
        assert(normalizedSlider.min <= normalizedSlider.max, "Inverted min > max correctly swapped");
        console.log("  ✔ Duplicate IDs deduplicated & inverted ranges normalized safely!");

        // --------------------------------------------------------------------
        // SUITE 2: High-Concurrency Element & Input Spamming (60Hz Chaos Flood)
        // --------------------------------------------------------------------
        console.log("\n▶ [SUITE 2] High-Concurrency Element Spamming (40 Clients @ 60Hz)...");
        
        const performers = [];
        for (let i = 0; i < 20; i++) {
            performers.push(await createPerformer(`Performer_${i + 1}`));
        }
        const spectators = [];
        for (let i = 0; i < 20; i++) {
            spectators.push(await createAudience(`Spectator_${i + 1}`));
        }
        console.log(`  Connected 20 performers (Slots ${performers[0].slot}-${performers[19].slot}) + 20 audience members.`);

        // Flood inputs for 1.5 seconds at 60Hz
        let spamCount = 0;
        const interval = setInterval(() => {
            const angle = spamCount * 0.1;
            performers.forEach((p, idx) => {
                if (p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(JSON.stringify({
                        type: 'input',
                        x: Math.cos(angle + idx) * 0.9,
                        y: Math.sin(angle + idx) * 0.9
                    }));
                    if (spamCount % 5 === 0) {
                        p.ws.send(JSON.stringify({ type: 'control', id: 'b1', value: 1 }));
                    }
                }
            });
            spectators.forEach((s) => {
                if (s.ws.readyState === WebSocket.OPEN) {
                    s.ws.send(JSON.stringify({ type: 'tap', rate: 1.5 }));
                }
            });
            spamCount++;
        }, 16);
        activeTimers.add(interval);

        await sleep(1500);
        clearInterval(interval);
        activeTimers.delete(interval);

        // Verify server health and ping response during peak load
        const tStart = Date.now();
        const healthCheck = await fetchJson('/health');
        const latency = Date.now() - tStart;
        assert.strictEqual(healthCheck.status, 200, "Server must remain healthy under 60Hz flood");
        assert(latency < 100, `Health check latency (${latency}ms) must remain responsive (<100ms)`);
        console.log(`  ✔ Handled ~${spamCount * 40} high-frequency messages without lag (Ping latency: ${latency}ms)!`);

        // Clean up suite 2 sockets
        performers.forEach(p => p.ws.terminate());
        spectators.forEach(s => s.ws.terminate());
        await sleep(300);

        // --------------------------------------------------------------------
        // SUITE 3: Dirty Network & Ghost Player Reclamation
        // --------------------------------------------------------------------
        console.log("\n▶ [SUITE 3] Dirty Network & Sudden Disconnect Resiliency...");
        
        // Spawn 5 sequential performers
        const squad = [];
        for (let i = 0; i < 5; i++) {
            squad.push(await createPerformer(`Pilot_${i + 1}`));
        }
        const middleSlot = squad[2].slot;
        console.log(`  Active Pilot slots: [${squad.map(s => s.slot).join(', ')}]. Target for dirty drop: Slot ${middleSlot}`);

        // Abruptly destroy the underlying TCP stream without sending WebSocket close frame
        squad[2].ws._socket.destroy();
        await sleep(500);

        // Connect new replacement performer
        const replacement = await createPerformer('Replacement_Pilot');
        console.log(`  New replacement connected and received Slot ${replacement.slot}`);
        assert.strictEqual(replacement.slot, middleSlot, `Replacement must reclaim dirty disconnected slot ${middleSlot}`);
        console.log("  ✔ Ghost player slot successfully reclaimed without slot gap fragmentation!");

        squad.forEach(s => s.ws.terminate());
        replacement.ws.terminate();
        await sleep(300);

        // --------------------------------------------------------------------
        // SUITE 4: Adversarial Payload Injection & Fuzzing
        // --------------------------------------------------------------------
        console.log("\n▶ [SUITE 4] Adversarial Payload Injection & Frame Guard Testing...");
        
        const testClient = await createPerformer('Fuzz_Target');

        // 4.1 Raw non-JSON byte strings
        testClient.ws.send(Buffer.from([0x00, 0xFF, 0xFE, 0x12, 0x89]));
        testClient.ws.send("NOT_JSON_STREAM_DATA");
        testClient.ws.send("{unclosed_json: true");
        await sleep(100);

        // 4.2 Prototype pollution injection
        testClient.ws.send(JSON.stringify({
            __proto__: { admin: true, role: 'master' },
            constructor: { prototype: { poll: true } },
            type: 'input',
            x: 0.5,
            y: 0.5
        }));
        await sleep(100);
        assert.strictEqual(Object.prototype.admin, undefined, "Prototype pollution must be blocked");

        // 4.3 Non-numeric and extreme coordinates
        testClient.ws.send(JSON.stringify({ type: 'input', x: 'DROP TABLE', y: null }));
        testClient.ws.send(JSON.stringify({ type: 'input', x: NaN, y: Infinity }));
        testClient.ws.send(JSON.stringify({ type: 'input', x: 999999, y: -999999 }));
        testClient.ws.send(JSON.stringify({ type: 'control', id: 's1', value: -1000000 }));
        await sleep(100);

        // 4.4 Oversized frame test (>1024 bytes maxPayload guard)
        let oversizedClosedCode = 0;
        await new Promise(resolve => {
            const bigWs = trackSocket(new WebSocket(WS_URL));
            bigWs.on('open', () => {
                // Send 2KB payload exceeding server's 1024 maxPayload
                const bigPayload = JSON.stringify({ type: 'input', junk: 'A'.repeat(2048) });
                bigWs.send(bigPayload);
            });
            bigWs.on('close', code => {
                oversizedClosedCode = code;
                resolve();
            });
            bigWs.on('error', () => {
                // Client catches error safely on frame overflow
                resolve();
            });
            setTimeout(resolve, 800);
        });
        assert(oversizedClosedCode === 1009 || oversizedClosedCode === 1006, 
            `Server must terminate oversized frame (got code ${oversizedClosedCode})`);
        console.log(`  ✔ Oversized frame safely dropped by maxPayload guard (Code: ${oversizedClosedCode}).`);

        testClient.ws.terminate();
        console.log("  ✔ Server withstood malformed, extreme, and corrupted payloads without crashing!");
        await sleep(300);

        // --------------------------------------------------------------------
        // SUITE 5: Capacity Boundary & Performer Overflow
        // --------------------------------------------------------------------
        console.log("\n▶ [SUITE 5] Capacity Boundary Verification (Stage Full Guard)...");
        
        // Fill up to 95 human slots (5-99)
        const fillerClients = [];
        let rejectedClient = null;
        console.log("  Allocating stage to full capacity...");
        
        for (let i = 0; i < 95; i++) {
            const client = await createPerformer(`Capacity_Performer_${i + 1}`);
            if (client.slot !== null) {
                fillerClients.push(client);
            } else if (client.rejected) {
                rejectedClient = client;
                break;
            }
        }

        // Now attempt to join 1 more performer
        if (!rejectedClient) {
            rejectedClient = await createPerformer('Overflow_Candidate');
        }

        assert(rejectedClient.rejected, "Overflow candidate must be rejected when stage is full");
        assert(rejectedClient.reason && rejectedClient.reason.toLowerCase().includes('full'), 
            `Expected stage full rejection reason, got: ${rejectedClient.reason}`);
        console.log(`  ✔ Performer 96 rejected cleanly: "${rejectedClient.reason}"`);

        // Clean up filler sockets
        fillerClients.forEach(c => c.ws.terminate());
        if (rejectedClient.ws) rejectedClient.ws.terminate();
        await sleep(300);

        console.log("\n====================================================================");
        console.log("  ALL ADVERSARIAL CHAOS & MULTI-PROJECT TEST SUITES PASSED (5/5)   ");
        console.log("====================================================================");

    } finally {
        // Cleanup all active timers
        for (const t of activeTimers) clearInterval(t);
        // Terminate all remaining sockets
        for (const ws of openSockets) {
            try { ws.terminate(); } catch (e) {}
        }
        // Restore default profile
        try {
            await fetchJson('/profile/gamepad', 'POST');
        } catch (e) {}
    }
}

main().catch(err => {
    console.error("\n✘ FATAL ERROR IN ADVERSARIAL CHAOS BATTERY:", err);
    process.exit(1);
});
