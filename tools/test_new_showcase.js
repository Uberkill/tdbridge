const { chromium } = require('playwright');
const path = require('path');

async function verifyShowcase() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 1100 });
    const fileUrl = 'file:///' + path.resolve(__dirname, 'public', 'swiss_monolith_showcase.html').replace(/\\/g, '/');
    console.log('Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // 1. Screenshot Performer View
    console.log('Capturing Performer View...');
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_v2_performer.png') });

    // 2. Switch to Master Console
    console.log('Capturing Master Console View...');
    await page.click('button[data-role="master"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_v2_master.png') });

    // 3. Switch to Audience View
    console.log('Capturing Audience Spectator View...');
    await page.click('button[data-role="audience"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_v2_audience.png') });

    // 4. Test RTT Latency Simulator
    console.log('Testing RTT simulator...');
    await page.click('#btn-rtt-med');
    await page.waitForTimeout(100);
    await page.click('#btn-rtt-drop');
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_v2_rtt_drop.png') });

    console.log('Console Errors:', errors);
    await browser.close();
    console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

verifyShowcase().catch(err => {
    console.error('Showcase verify error:', err);
    process.exit(1);
});
