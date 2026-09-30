const { chromium } = require('playwright');
const path = require('path');
const http = require('http');

function getRoomCode() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:8080/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.room);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function runLiveE2ETest() {
    console.log('===============================================================');
    console.log('        STARTING LIVE TOUCHDESIGNER E2E TEST                   ');
    console.log('===============================================================');
    const room = await getRoomCode();
    console.log(`[TEST] Detected Active Room Code from Relay: ${room}`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro

    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
        else console.log(`  [Browser] ${msg.text()}`);
    });
    page.on('pageerror', err => errors.push(err.message));

    // 1. Navigate to client
    const targetUrl = `http://localhost:8080/?room=${room}`;
    console.log(`[TEST] Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Verify room code display in segmented boxes
    const c0 = await page.$eval('#code-0', el => el.value);
    const c1 = await page.$eval('#code-1', el => el.value);
    const c2 = await page.$eval('#code-2', el => el.value);
    const c3 = await page.$eval('#code-3', el => el.value);
    const fullRoomCode = `${c0}${c1}${c2}${c3}`;
    console.log(`[TEST] Segmented Room Code in Gate: "${fullRoomCode}" (Matches Relay: ${fullRoomCode === room})`);

    // 2. Set Performer Handle and Swatch
    await page.fill('#player-name', 'ALEX_V');
    const limeSwatch = await page.$('.swatch[data-name="LIME"]');
    if (limeSwatch) await limeSwatch.click();
    console.log('[TEST] Configured user: ALEX_V with LIME swatch');

    // Screenshot Gate
    await page.screenshot({ path: path.resolve(__dirname, '..', 'public', 'test_1_gate.png') });

    // 3. Connect to Surface
    console.log('[TEST] Clicking [CONNECT TO SURFACE]...');
    await page.click('#join-btn');
    await page.waitForSelector('#ui', { state: 'visible', timeout: 6000 });
    await page.waitForTimeout(1000);

    const slotText = await page.$eval('#slot-indicator', el => el.textContent.trim());
    console.log(`[TEST] Assigned Slot Indicator: "${slotText}"`);

    const rttText = await page.$eval('#rtt-status', el => el.textContent.trim());
    console.log(`[TEST] Real Network RTT Readout: "${rttText}"`);

    // Screenshot Performer UI
    await page.screenshot({ path: path.resolve(__dirname, '..', 'public', 'test_2_performer.png') });

    // 4. Test Joystick Drag
    console.log('[TEST] Dragging Joystick Vector Reticle...');
    const boundary = await page.$('#joystick-boundary');
    if (boundary) {
        const box = await boundary.boundingBox();
        if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await page.mouse.move(cx, cy);
            await page.mouse.down();
            await page.mouse.move(cx + 45, cy - 35, { steps: 5 });
            await page.waitForTimeout(300);
            await page.screenshot({ path: path.resolve(__dirname, '..', 'public', 'test_3_joystick.png') });
            await page.mouse.up();
            await page.waitForTimeout(200);
        }
    }

    // 5. Test Buttons (b1 Rotate, b2 Color, b3 Feed, b4 Special)
    console.log('[TEST] Triggering TouchDesigner Action Buttons...');
    console.log('  -> Button 1 (Rotate 360°)');
    await page.click('#btn-b1');
    await page.waitForTimeout(300);

    console.log('  -> Button 2 (Color Swap)');
    await page.click('#btn-b2');
    await page.waitForTimeout(300);

    console.log('  -> Button 3 (Feed Fish)');
    await page.click('#btn-b3');
    await page.waitForTimeout(300);

    console.log('  -> Button 4 (Special/Scare)');
    await page.click('#btn-b4');
    await page.waitForTimeout(300);

    // 6. Test Dual Sliders (s1 Speed, s2 Scale)
    console.log('[TEST] Adjusting Dual Sliders...');
    await page.fill('#slider-s1', '85');
    await page.dispatchEvent('#slider-s1', 'input');
    await page.waitForTimeout(100);

    await page.fill('#slider-s2', '75');
    await page.dispatchEvent('#slider-s2', 'input');
    await page.waitForTimeout(200);

    // 7. Test Master Operator Console
    console.log('[TEST] Switching to Master Console Tab...');
    await page.click('.role-nav-tab[data-view="master"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, '..', 'public', 'test_4_master.png') });

    console.log('  -> Switching Scene to CANVAS');
    await page.click('button[data-scene="canvas"]');
    await page.waitForTimeout(300);

    console.log('  -> Switching Scene to AQUARIUM');
    await page.click('button[data-scene="aquarium"]');
    await page.waitForTimeout(300);

    console.log('  -> Triggering System Reset');
    await page.click('#cue-reset-btn');
    await page.waitForTimeout(300);

    // 8. Test Audience Hype Surface
    console.log('[TEST] Switching to Audience Hype Tab...');
    await page.click('.role-nav-tab[data-view="audience"]');
    await page.waitForTimeout(300);

    console.log('  -> Tapping BPM Pulser 4 times (120 BPM rhythm)');
    for (let i = 0; i < 4; i++) {
        await page.click('#audience-bpm-tap');
        await page.waitForTimeout(450);
    }

    console.log('  -> Sending Reaction Burst');
    await page.click('.reaction-tile[data-reaction="fire"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, '..', 'public', 'test_5_audience.png') });

    // 9. Leave cleanly
    console.log('[TEST] Disconnecting from session...');
    await page.click('#exit-btn');
    await page.waitForSelector('#gate', { state: 'visible', timeout: 5000 });
    console.log('[TEST] Cleanly returned to Gate!');

    await browser.close();
    console.log(`[TEST COMPLETED] Total page errors: ${errors.length}`);
    if (errors.length > 0) {
        console.error('Errors encountered:', errors);
        process.exit(1);
    }
}

runLiveE2ETest().catch(err => {
    console.error('Live Test Failed:', err);
    process.exit(1);
});
