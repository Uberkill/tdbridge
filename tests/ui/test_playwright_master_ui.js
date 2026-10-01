const { chromium } = require('playwright');
const http = require('http');

async function fetchTelemetry() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8080/telemetry', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function run() {
    console.log("=== Testing Frontend UI via Playwright (Windows) ===");

    const t = await fetchTelemetry();
    const roomCode = t.system.room_code;
    console.log(`Target Room Code: ${roomCode}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 412, height: 915 } }); // Mobile phone viewport
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
        consoleErrors.push(err.message);
    });

    console.log("[1] Navigating to http://127.0.0.1:8080?room=" + roomCode);
    await page.goto(`http://127.0.0.1:8080?room=${roomCode}`);
    await page.waitForTimeout(1000);

    // Verify Lobby Elements
    const title = await page.textContent('#brand-title');
    console.log(`[1] Brand title: ${title}`);

    const performerBtn = await page.locator('.role-select-btn[data-role="performer"]');
    const spectatorBtn = await page.locator('.role-select-btn[data-role="audience"]');
    const isPerformerVisible = await performerBtn.isVisible();
    const isSpectatorVisible = await spectatorBtn.isVisible();
    console.log(`[1] Binary Pathway Buttons Visible: Performer=${isPerformerVisible}, Spectator=${isSpectatorVisible}`);

    const masterConsoleBtn = await page.locator('#open-master-modal-btn');
    const isMasterBtnVisible = await masterConsoleBtn.isVisible();
    console.log(`[1] FOH Operator Button Visible: ${isMasterBtnVisible}`);

    // Verify Master Modal
    console.log("[2] Opening FOH Master Login Modal...");
    await masterConsoleBtn.click();
    await page.waitForTimeout(300);

    const isModalVisible = await page.locator('#master-auth-modal').isVisible();
    console.log(`[2] Master Auth Modal Visible: ${isModalVisible}`);

    // Close Modal
    await page.locator('#master-auth-cancel-btn').click();
    await page.waitForTimeout(300);
    const isModalClosed = !(await page.locator('#master-auth-modal').isVisible());
    console.log(`[2] Master Auth Modal Closed on Cancel: ${isModalClosed}`);

    // Test Attendee Pathway: Spectator
    console.log("[3] Testing Spectator Pathway...");
    await spectatorBtn.click();
    await page.waitForTimeout(200);

    const isSwatchHidden = !(await page.locator('#swatch-section').isVisible());
    console.log(`[3] Swatch section hidden for spectator: ${isSwatchHidden}`);

    await page.locator('#join-btn').click();
    await page.waitForTimeout(1000);

    const isAudienceUiVisible = await page.locator('#view-audience').isVisible();
    console.log(`[3] Spectator Audience Surface Visible: ${isAudienceUiVisible}`);

    // Verify Swiss Brutalist Badges
    const badge1 = await page.locator('.reaction-tile[data-reaction="ignite"] .reaction-badge').textContent();
    const badge2 = await page.locator('.reaction-tile[data-reaction="strobe"] .reaction-badge').textContent();
    const badge3 = await page.locator('.reaction-tile[data-reaction="flux"] .reaction-badge').textContent();
    const badge4 = await page.locator('.reaction-tile[data-reaction="burst"] .reaction-badge').textContent();
    console.log(`[3] Reaction Badges: ${badge1} | ${badge2} | ${badge3} | ${badge4}`);

    // Tap BPM
    await page.locator('#audience-bpm-tap').click();
    await page.waitForTimeout(300);
    await page.locator('#audience-bpm-tap').click();

    // Disconnect Spectator
    await page.locator('#exit-btn').click();
    await page.waitForTimeout(500);

    // Test Attendee Pathway: Performer
    console.log("[4] Testing Performer Pathway...");
    await performerBtn.click();
    await page.waitForTimeout(200);
    await page.locator('#join-btn').click();
    await page.waitForTimeout(1000);

    const isPerformerUiVisible = await page.locator('#view-performer').isVisible();
    const slotText = await page.locator('#slot-indicator').textContent();
    console.log(`[4] Performer Surface Visible: ${isPerformerUiVisible}, Indicator: ${slotText}`);

    // Trigger action buttons
    await page.locator('#btn-b1').dispatchEvent('pointerdown');
    await page.locator('#btn-b1').dispatchEvent('pointerup');
    await page.locator('#btn-b2').dispatchEvent('pointerdown');
    await page.locator('#btn-b2').dispatchEvent('pointerup');

    // Disconnect Performer
    await page.locator('#exit-btn').click();
    await page.waitForTimeout(500);

    // Check Console Errors
    console.log(`[5] Total Uncaught Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
        console.error("Errors found:", consoleErrors);
    }

    await browser.close();

    if (consoleErrors.length === 0 && isPerformerVisible && isSpectatorVisible && isMasterBtnVisible && isAudienceUiVisible && isPerformerUiVisible) {
        console.log("\n[PASS] All Playwright browser UI tests passed with zero errors!");
        process.exit(0);
    } else {
        console.error("\n[FAIL] Playwright UI test failures detected.");
        process.exit(1);
    }
}

run().catch(err => {
    console.error("Fatal Playwright test error:", err);
    process.exit(1);
});
