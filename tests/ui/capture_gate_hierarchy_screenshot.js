const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

async function fetchTelemetry() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/telemetry', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function capture() {
    const t = await fetchTelemetry();
    const roomCode = t.system.room_code;
    const sessionName = t.system.session_name || 'MAIN STAGE';
    console.log(`Room Code: ${roomCode}, Session Name: ${sessionName}`);

    const browser = await chromium.launch({ headless: true });

    // 1. Mobile Viewport (iPhone / Pixel format: 412x915)
    const mobileContext = await browser.newContext({ viewport: { width: 412, height: 915 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://127.0.0.1:8080?room=${roomCode}`);
    await mobilePage.waitForTimeout(800);

    const artifactDir = process.env.ARTIFACT_DIR || path.resolve(__dirname, '../../artifacts');
    if (!require('fs').existsSync(artifactDir)) require('fs').mkdirSync(artifactDir, { recursive: true });

    const mobileArtifact = path.resolve(artifactDir, 'onboarding_gate_mobile_hierarchy.png');
    await mobilePage.screenshot({ path: mobileArtifact, fullPage: true });
    console.log(`Mobile Gate Screenshot saved to: ${mobileArtifact}`);

    // 2. Desktop Viewport (1080p: 1920x1080)
    const desktopContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(`http://127.0.0.1:8080?room=${roomCode}`);
    await desktopPage.waitForTimeout(800);

    const desktopArtifact = path.resolve(artifactDir, 'onboarding_gate_desktop_hierarchy.png');
    await desktopPage.screenshot({ path: desktopArtifact, fullPage: true });
    console.log(`Desktop Gate Screenshot saved to: ${desktopArtifact}`);

    await browser.close();
    console.log("Screenshots captured successfully!");
}

capture().catch(err => {
    console.error("Failed to capture screenshots:", err);
    process.exit(1);
});
