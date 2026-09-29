const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log("=========================================================");
console.log("           TDBRIDGE UNIFIED TEST SUITE RUNNER            ");
console.log("=========================================================\n");

const tests = [
    { name: "Controller Profile Switching", file: "tests/e2e/test_profile_switching.js" },
    { name: "Live CHOP & DAT Stream", file: "tests/e2e/test_live_chop_feed.js" },
    { name: "Aquarium Expansion & Feeding", file: "tests/e2e/verify_aquarium_expansion.js" },
    { name: "Single Player Interactive Scenario", file: "tests/e2e/test_scenario.js" },
    { name: "Multi-Player Concurrency", file: "tests/e2e/test_multi_player.js" }
];

let passed = 0;
let failed = 0;

for (const t of tests) {
    const fullPath = path.resolve(__dirname, '..', t.file);
    if (!fs.existsSync(fullPath)) {
        console.log(`[SKIP] ${t.name}: File not found (${t.file})`);
        continue;
    }

    console.log(`\n▶ RUNNING: ${t.name}...`);
    const start = Date.now();
    const res = spawnSync('node', [fullPath], { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (res.status === 0) {
        console.log(`✔ [PASS] ${t.name} (${elapsed}s)`);
        passed++;
    } else {
        console.error(`✘ [FAIL] ${t.name} (exit code ${res.status})`);
        failed++;
    }
}

console.log("\n=========================================================");
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log("=========================================================");

process.exit(failed > 0 ? 1 : 0);
