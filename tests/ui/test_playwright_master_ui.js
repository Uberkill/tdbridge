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
    console.log(`[1] Dynamic Session Title: ${title}`);

    // Verify Spectator is Completely Purged from User UI
    const roleSelectorCount = await page.locator('.role-select-btn').count();
    console.log(`[1] Spectator/Performer Pathway Toggle Count: ${roleSelectorCount} (Expected: 0)`);

    // Verify Compact Swatch Pills
    const swatchCount = await page.locator('.swatch-pill').count();
    console.log(`[1] Compact Swatch Pills Count: ${swatchCount} (Expected: 8)`);

    // Verify Randomize Button rolls handle & color
    const initialName = await page.inputValue('#player-name');
    await page.locator('#random-name-btn').click();
    await page.waitForTimeout(100);
    const randomizedName = await page.inputValue('#player-name');
    console.log(`[1] Randomize Button: "${initialName}" -> "${randomizedName}"`);

    // Verify Gate Status Pill is completely purged from attendee gate
    const gatePillCount = await page.locator('#gate-status-pill').count();
    console.log(`[1] Diagnostic Gate Status Pill Count: ${gatePillCount} (Expected: 0)`);

    const masterConsoleBtn = await page.locator('#open-master-modal-btn');
    const isMasterBtnVisible = await masterConsoleBtn.isVisible();
    console.log(`[1] Covert FOH Operator Trigger Visible: ${isMasterBtnVisible}`);

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

    // Test Single Action Performer Join
    console.log("[3] Testing Direct Performer Entry (ENTER STAGE)...");
    const joinBtnText = await page.textContent('#join-btn');
    console.log(`[3] Single Primary Button Text: "${joinBtnText.trim().replace(/\s+/g, ' ')}"`);

    // Click a swatch pill
    await page.locator('.swatch-pill[data-name="MAGENTA"]').click();
    await page.waitForTimeout(100);

    await page.locator('#join-btn').click();
    await page.waitForTimeout(1000);

    const isPerformerUiVisible = await page.locator('#view-performer').isVisible();
    const isAudienceUiHidden = !(await page.locator('#view-audience').isVisible());
    const slotText = await page.locator('#slot-indicator').textContent();
    console.log(`[3] Performer Surface Visible: ${isPerformerUiVisible}, Spectator Hidden: ${isAudienceUiHidden}, Slot: ${slotText}`);

    // Trigger action buttons
    await page.locator('#btn-b1').dispatchEvent('pointerdown');
    await page.locator('#btn-b1').dispatchEvent('pointerup');
    await page.locator('#btn-b2').dispatchEvent('pointerdown');
    await page.locator('#btn-b2').dispatchEvent('pointerup');

    // Disconnect Performer
    await page.locator('#exit-btn').click();
    await page.waitForTimeout(500);

    const isBackAtGate = await page.locator('#gate').isVisible();
    console.log(`[4] Returned to Gate on Disconnect: ${isBackAtGate}`);

    // Check Console Errors
    console.log(`[5] Total Uncaught Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
        console.error("Errors found:", consoleErrors);
    }

    await browser.close();

    const isSuccess = (
        consoleErrors.length === 0 &&
        roleSelectorCount === 0 &&
        swatchCount === 8 &&
        isMasterBtnVisible &&
        isPerformerUiVisible &&
        isAudienceUiHidden &&
        isBackAtGate
    );

    if (isSuccess) {
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
