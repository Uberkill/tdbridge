const { chromium } = require('playwright');
const path = require('path');
const http = require('http');

async function getRoomCode() {
    return new Promise(resolve => {
        http.get('http://127.0.0.1:8080/health', res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data).room || ''); } catch (e) { resolve(''); }
            });
        }).on('error', () => resolve(''));
    });
}

async function capture() {
    const roomCode = await getRoomCode();
    console.log(`Launching headless browser to capture Swiss Monolith UI (Room: ${roomCode})...`);
    const browser = await chromium.launch({ headless: true });
    
    // 1. Mobile viewport (iPhone 14 Pro style)
    const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 2
    });
    const page = await context.newPage();

    const targetUrl = roomCode ? `http://127.0.0.1:8080?room=${roomCode}` : 'http://127.0.0.1:8080';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    const gateShotPath = path.resolve(__dirname, '..', 'public', 'screenshot_gate_swiss.png');
    await page.screenshot({ path: gateShotPath });
    console.log(`Saved Lobby Screenshot: ${gateShotPath}`);

    // Click connect to see active controller UI
    await page.click('#join-btn');
    await page.waitForTimeout(500);

    const uiShotPath = path.resolve(__dirname, '..', 'public', 'screenshot_ui_swiss.png');
    await page.screenshot({ path: uiShotPath });
    console.log(`Saved Controller Screenshot: ${uiShotPath}`);

    // 2. Tablet / Desktop viewport (iPad landscape style)
    const tabContext = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 2
    });
    const tab = await tabContext.newPage();
    await tab.goto('http://127.0.0.1:8080?room=HFTE', { waitUntil: 'networkidle' });
    await tab.click('#join-btn');
    await tab.waitForTimeout(500);

    const tabletShotPath = path.resolve(__dirname, '..', 'public', 'screenshot_tablet_swiss.png');
    await tab.screenshot({ path: tabletShotPath });
    console.log(`Saved Tablet Screenshot: ${tabletShotPath}`);

    await browser.close();
    console.log("All UI captures complete!");
}

capture().catch(err => {
    console.error("Capture error:", err);
    process.exit(1);
});
