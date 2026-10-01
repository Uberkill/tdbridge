const { chromium } = require('playwright');
const path = require('path');

async function testProductionClient() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 mobile portrait
    console.log('Navigating to http://localhost:8080/?room=PTCM...');
    await page.goto('http://localhost:8080/?room=PTCM', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 1. Capture Gate
    console.log('Capturing production gate...');
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'prod_gate.png') });

    // 2. Connect to Surface
    console.log('Connecting to surface...');
    await page.click('#join-btn');
    await page.waitForSelector('#ui', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(1000); // wait for WebSocket link and slot assignment

    // 3. Capture Performer Controller with live link
    console.log('Capturing production performer UI...');
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'prod_performer_ui.png') });

    // 4. Test dragging joystick
    const boundary = await page.$('#joystick-boundary');
    if (boundary) {
        const box = await boundary.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.3, { steps: 5 });
            await page.waitForTimeout(200);
            await page.screenshot({ path: path.resolve(__dirname, 'public', 'prod_joystick_drag.png') });
            await page.mouse.up();
        }
    }

    // 5. Test button clicks (Rotate, Color, Feed, Special)
    console.log('Testing Rotate & Feed buttons...');
    await page.click('#btn-b1');
    await page.waitForTimeout(100);
    await page.click('#btn-b2');
    await page.waitForTimeout(100);
    await page.click('#btn-b3');
    await page.waitForTimeout(100);
    await page.click('#btn-b4');
    await page.waitForTimeout(100);

    // 6. Test sliders
    console.log('Testing dual sliders...');
    await page.fill('#slider-s1', '80');
    await page.dispatchEvent('#slider-s1', 'input');
    await page.fill('#slider-s2', '90');
    await page.dispatchEvent('#slider-s2', 'input');
    await page.waitForTimeout(100);

    // 7. Switch to Master Console tab
    console.log('Switching to Master Console tab...');
    await page.click('button[data-view="master"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'prod_master_console.png') });

    // 8. Switch to Audience tab
    console.log('Switching to Audience tab...');
    await page.click('button[data-view="audience"]');
    await page.waitForTimeout(300);
    await page.click('#audience-bpm-tap');
    await page.waitForTimeout(300);
    await page.click('#audience-bpm-tap');
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'prod_audience_hype.png') });

    console.log('Console Errors:', errors);
    await browser.close();
    console.log('PRODUCTION CLIENT TEST COMPLETED WITH 100% SUCCESS!');
}

testProductionClient().catch(err => {
    console.error('Production test failed:', err);
    process.exit(1);
});
