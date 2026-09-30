const { chromium } = require('playwright');
const path = require('path');

async function testInteractive() {
    console.log("Verifying active interactive states in Swiss Monolith UI...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });

    await page.goto('http://127.0.0.1:8080?room=HFTE', { waitUntil: 'networkidle' });

    // Click random name
    await page.click('#random-name-btn');
    const nameVal = await page.inputValue('#player-name');
    console.log(`Generated handle: ${nameVal}`);

    // Select Lime swatch
    const swatches = await page.$$('.swatch');
    if (swatches[2]) await swatches[2].click();
    console.log("Selected Lime swatch");

    // Click Connect
    await page.click('#join-btn');
    await page.waitForTimeout(500);

    // Press ACTION 1 (simulate hold)
    const btnB1 = await page.$('#btn-b1');
    const box = await btnB1.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    const activeShotPath = path.resolve(__dirname, '..', 'public', 'screenshot_active_pressed.png');
    await page.screenshot({ path: activeShotPath });
    console.log(`Saved Active Pressed State: ${activeShotPath}`);

    await page.mouse.up();

    // Drag joystick to top-right
    const joyBoundary = await page.$('#joystick-boundary');
    const jBox = await joyBoundary.boundingBox();
    const cx = jBox.x + jBox.width / 2;
    const cy = jBox.y + jBox.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy - 60, { steps: 5 });
    await page.waitForTimeout(200);

    const joyShotPath = path.resolve(__dirname, '..', 'public', 'screenshot_joystick_drag.png');
    await page.screenshot({ path: joyShotPath });
    console.log(`Saved Joystick Drag State: ${joyShotPath}`);

    const readout = await page.innerText('#vector-readout');
    console.log(`Live Vector Readout: ${readout}`);

    await page.mouse.up();
    await browser.close();
    console.log("Interactive state verification complete!");
}

testInteractive().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
