// ============================================================================
// TDBRIDGE // UNIFIED MASTER TEST ORCHESTRATOR
// Deterministic, end-to-end verification across all 6 core system domains.
// ============================================================================

const { spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const CWD = path.resolve(__dirname, '..');

function hr(char = '=') {
    return char.repeat(68);
}

function probeHttp(url, timeoutMs = 2000) {
    return new Promise(resolve => {
        const req = http.get(url, { timeout: timeoutMs }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve({ ok: res.statusCode === 200, data: JSON.parse(body) }); }
                catch (e) { resolve({ ok: res.statusCode === 200, data: body }); }
            });
        });
        req.on('error', () => resolve({ ok: false, data: null }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, data: null }); });
    });
}

async function main() {
    console.log(hr());
    console.log("       TDBRIDGE // DETERMINISTIC MASTER TEST ORCHESTRATOR      ");
    console.log("       6-Domain Verification Suite & Systems Integrity Gate     ");
    console.log(hr());
    console.log(`Execution Timestamp: ${new Date().toISOString()}`);

    // Pre-flight check
    process.stdout.write("[*] Verifying Relay Server on port 8080... ");
    let relayCheck = await probeHttp('http://127.0.0.1:8080/health');
    let spawnedRelay = null;
    if (!relayCheck.ok || !relayCheck.data?.room) {
        console.log("\x1b[33mOFFLINE (Auto-starting relay)...\x1b[0m");
        const { spawn } = require('child_process');
        spawnedRelay = spawn('node', ['dist/relay.js'], { 
            cwd: CWD, 
            stdio: 'ignore', 
            detached: true,
            env: { ...process.env, NO_TUNNEL: '1' }
        });
        spawnedRelay.unref();
        for (let attempt = 0; attempt < 25; attempt++) {
            await new Promise(r => setTimeout(r, 200));
            relayCheck = await probeHttp('http://127.0.0.1:8080/health');
            if (relayCheck.ok && relayCheck.data?.room) break;
        }
        if (!relayCheck.ok || !relayCheck.data?.room) {
            console.error("FATAL: Failed to auto-start Relay Server on :8080.");
            process.exit(1);
        }
    }
    console.log(`\x1b[32mONLINE\x1b[0m (Room: ${relayCheck.data.room})`);

    process.stdout.write("[*] Verifying TouchDesigner Bridge on port 9980... ");
    const tdCheck = await probeHttp('http://127.0.0.1:9980/api/info');
    if (tdCheck.ok && tdCheck.data?.ok) {
        console.log(`\x1b[32mONLINE\x1b[0m (Project: ${tdCheck.data.data.project})`);
    } else {
        console.log("\x1b[33mOFFLINE (Proceeding with standalone mocks)\x1b[0m");
    }

    console.log(hr('-'));

    const testDomains = [
        {
            domain: "DOMAIN 1: UNIT & PROTOCOL VALIDATION",
            cmd: "npx",
            args: ["jest", "--colors", "tests/unit/client.test.ts"]
        },
        {
            domain: "DOMAIN 2: ZERO-TRUST SECURITY & INJECTION",
            cmd: "node",
            args: ["tests/security/test_master_security.js"]
        },
        {
            domain: "DOMAIN 3: FOH MASTER CONSOLE & REMOTE KICK",
            cmd: "node",
            args: ["tests/security/test_full_master_lifecycle.js"]
        },
        {
            domain: "DOMAIN 4: 4-DOMAIN TELEMETRY & PORT HYGIENE",
            cmd: "node",
            args: ["tests/telemetry/test_telemetry_and_ports.js"]
        },
        {
            domain: "DOMAIN 5: ENGINE REMEDIATION & INVARIANTS",
            cmd: "node",
            args: ["tests/e2e/verify_remediation_battery.js"]
        },
        {
            domain: "DOMAIN 6: MULTI-PLAYER SCENARIOS & PROFILES",
            cmd: "node",
            args: ["tests/run_all_tests.js"]
        },
        {
            domain: "DOMAIN 7: HEADLESS PLAYWRIGHT BROWSER UI",
            cmd: "node",
            args: ["tests/ui/test_playwright_master_ui.js"]
        },
        {
            domain: "DOMAIN 8: HYBRID MULTI-SCENE & PARTICLE CANVAS",
            cmd: "node",
            args: ["tests/e2e/test_scene_and_particle_canvas.js"]
        },
        {
            domain: "DOMAIN 9: SELF-HEALING ARCHITECTURE & MASTER PIN",
            cmd: "node",
            args: ["tests/e2e/test_self_heal_and_master_pin.js"]
        },
        {
            domain: "DOMAIN 10: ADVERSARIAL CHAOS & MULTI-PROJECT GENERALIZATION",
            cmd: "node",
            args: ["tests/e2e/test_adversarial_chaos_battery.js"]
        }
    ];

    const results = [];
    let allPassed = true;
    const globalStart = Date.now();

    for (let i = 0; i < testDomains.length; i++) {
        const t = testDomains[i];
        console.log(`\n▶ [${i + 1}/${testDomains.length}] EXECUTING: ${t.domain}`);
        console.log(hr('-'));

        const stageStart = Date.now();
        const res = spawnSync(t.cmd, t.args, {
            cwd: CWD,
            stdio: 'inherit',
            shell: true
        });
        const elapsed = ((Date.now() - stageStart) / 1000).toFixed(2);

        if (res.status === 0) {
            results.push({ name: t.domain, passed: true, elapsed });
            console.log(`\n\x1b[32m✔ [PASSED]\x1b[0m ${t.domain} in ${elapsed}s`);
        } else {
            results.push({ name: t.domain, passed: false, elapsed, code: res.status });
            console.log(`\n\x1b[31m✘ [FAILED]\x1b[0m ${t.domain} (Exit Code: ${res.status}) in ${elapsed}s`);
            allPassed = false;
        }
    }

    const totalElapsed = ((Date.now() - globalStart) / 1000).toFixed(2);

    console.log("\n" + hr());
    console.log("            TDBRIDGE MASTER TEST EXECUTION SUMMARY              ");
    console.log(hr());

    results.forEach((r, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        const badge = r.passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
        const time = `${r.elapsed}s`.padStart(7, ' ');
        console.log(`  ${badge} [${num}] ${r.name.padEnd(46, ' ')} ${time}`);
    });

    console.log(hr('-'));
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`TOTAL RESULT: ${passedCount}/${totalCount} DOMAINS PASSED (${totalElapsed}s Total)`);

    if (allPassed) {
        console.log("\x1b[32m[STATUS: 100% SYSTEM PASS // DETERMINISTIC QUALITY GATE VERIFIED]\x1b[0m");
    } else {
        console.log("\x1b[31m[STATUS: VERIFICATION FAILED // ATTENTION REQUIRED]\x1b[0m");
    }
    console.log(hr() + "\n");

    if (spawnedRelay && spawnedRelay.pid) {
        try {
            process.kill(spawnedRelay.pid);
        } catch (e) {}
    }

    process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
    console.error("FATAL MASTER TEST RUNNER ERROR:", err);
    process.exit(1);
});
