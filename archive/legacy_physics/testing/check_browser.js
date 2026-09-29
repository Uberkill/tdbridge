const { chromium } = require('playwright');

(async () => {
    console.log("Launching browser...");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
    page.on('requestfailed', request => console.log('NETWORK FAILED:', request.url(), request.failure().errorText));

    console.log("Navigating to http://127.0.0.1:8080 ...");
    await page.goto('http://127.0.0.1:8080', { waitUntil: 'networkidle' });
    
    console.log("Waiting 2 seconds...");
    await page.waitForTimeout(2000);
    
    console.log("HTML Body:");
    const body = await page.innerHTML('body');
    console.log(body.substring(0, 500));
    
    await browser.close();
})();
