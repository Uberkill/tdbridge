const fs = require('fs');
const path = require('path');

const files = [
    'tests/test_audience_role.js',
    'tests/test_ghost_fish_elimination.js',
    'tests/test_live_e2e_touchdesigner.js',
    'tests/verify_remediation_battery.js',
    'tests/e2e/run_test_with_verification.js',
    'tests/e2e/stress_test_edge_cases.js',
    'tests/e2e/test_custom_controls.js',
    'tests/e2e/test_live_chop_feed.js',
    'tests/e2e/test_multi_player.js',
    'tests/e2e/test_profile_switching.js',
    'tests/e2e/test_scenario.js',
    'tests/e2e/verify_aquarium_expansion.js'
];

for (const rel of files) {
    const p = path.join(__dirname, '..', rel);
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf-8');
        content = content.replace(/['"]http:\/\/127\.0\.0\.1:8080\/room['"]/g, "'http://127.0.0.1:8080/health'");
        content = content.replace(/['"]http:\/\/localhost:8080\/room['"]/g, "'http://localhost:8080/health'");
        content = content.replace(/get\(['"]\/room['"]\)/g, "get('/health')");
        content = content.replace(/httpGet\(['"]\/room['"]\)/g, "httpGet('/health')");
        fs.writeFileSync(p, content, 'utf-8');
        console.log(`Updated ${rel}`);
    }
}
