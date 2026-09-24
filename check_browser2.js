const { chromium } = require('playwright');

(async () => {
    console.log("Launching browser...");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
    page.on('requestfailed', request => console.log('NETWORK FAILED:', request.url(), request.failure().errorText));
    page.on('websocket', ws => {
        console.log(`WebSocket opened: ${ws.url()}`);
        ws.on('framereceived', frame => console.log(`WS Receive: ${frame.payload}`));
        ws.on('framesent', frame => console.log(`WS Send: ${frame.payload}`));
        ws.on('close', () => console.log('WebSocket closed'));
    });

    console.log("Navigating to https://uberkill.github.io/tdbridge ...");
    await page.goto('https://uberkill.github.io/tdbridge', { waitUntil: 'networkidle' });
    
    console.log("Filling in room code...");
    await page.fill('#room-code-input', 'UAXQ');
    await page.fill('#player-name', 'AuditBot');
    
    console.log("Clicking connect...");
    await page.click('#join-btn');
    
    console.log("Waiting 3 seconds...");
    await page.waitForTimeout(3000);
    
    await browser.close();
})();
