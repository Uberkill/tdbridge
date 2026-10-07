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

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.resolve(__dirname, '../../artifacts');
if (!require('fs').existsSync(ARTIFACT_DIR)) require('fs').mkdirSync(ARTIFACT_DIR, { recursive: true });

const VIEWPORTS = [
    {
        name: 'iPhone 14/15/16 Pro (19.5:9 Ratio)',
        filename: 'gate_iphone_19_5_ratio.png',
        width: 393,
        height: 852,
        isMobile: true,
        hasTouch: true
    },
    {
        name: 'Android Flagship / Galaxy S24',
        filename: 'gate_android_flagship.png',
        width: 412,
        height: 915,
        isMobile: true,
        hasTouch: true
    },
    {
        name: 'iPad 10.2" Portrait (4:3 Ratio)',
        filename: 'gate_ipad_portrait_4_3.png',
        width: 810,
        height: 1080,
        isMobile: false,
        hasTouch: true
    },
    {
        name: 'iPad Pro 11" Landscape',
        filename: 'gate_ipad_pro_landscape.png',
        width: 1194,
        height: 834,
        isMobile: false,
        hasTouch: true
    },
    {
        name: 'Desktop 1080p FHD (16:9)',
        filename: 'gate_desktop_1080p.png',
        width: 1920,
        height: 1080,
        isMobile: false,
        hasTouch: false
    },
    {
        name: 'Desktop 4K UHD (3840x2160)',
        filename: 'gate_desktop_4k.png',
        width: 3840,
        height: 2160,
        isMobile: false,
        hasTouch: false
    }
];

async function run() {
    console.log("=== Capturing Multi-Viewport Screenshots across Mobile, iPad, and 4K ===");
    const t = await fetchTelemetry();
    const roomCode = t.system.room_code;
    const sessionName = t.system.session_name || 'MAIN STAGE';
    console.log(`Active Room Code: ${roomCode}, Session: ${sessionName}`);

    const browser = await chromium.launch({ headless: true });

    for (const vp of VIEWPORTS) {
        console.log(`\nCapturing: ${vp.name} (${vp.width}x${vp.height})...`);
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            isMobile: vp.isMobile,
            hasTouch: vp.hasTouch
        });
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:8080?room=${roomCode}`);
        await page.waitForTimeout(800);

        // Measure card dimensions in DOM
        const cardBox = await page.locator('#gate .mono-card').boundingBox();
        console.log(`  -> Card Dimensions: width=${Math.round(cardBox.width)}px, height=${Math.round(cardBox.height)}px (${Math.round((cardBox.width / vp.width) * 100)}% of viewport width)`);

        const targetPath = path.resolve(ARTIFACT_DIR, vp.filename);
        await page.screenshot({ path: targetPath, fullPage: true });
        console.log(`  -> Saved to: ${vp.filename}`);

        // Update default desktop & mobile hierarchy artifacts
        if (vp.filename === 'gate_desktop_1080p.png') {
            await page.screenshot({ path: path.resolve(ARTIFACT_DIR, 'onboarding_gate_desktop_hierarchy.png'), fullPage: true });
        }
        if (vp.filename === 'gate_iphone_19_5_ratio.png') {
            await page.screenshot({ path: path.resolve(ARTIFACT_DIR, 'onboarding_gate_mobile_hierarchy.png'), fullPage: true });
        }

        await context.close();
    }

    // Capture Performer Surface on 4K Desktop
    console.log("\nCapturing Performer Surface on 4K UHD (3840x2160)...");
    const performerContext = await browser.newContext({
        viewport: { width: 3840, height: 2160 }
    });
    const perfPage = await performerContext.newPage();
    await perfPage.goto(`http://127.0.0.1:8080?room=${roomCode}`);
    await perfPage.waitForTimeout(500);
    await perfPage.locator('#join-btn').click();
    await perfPage.waitForTimeout(1000);
    const perf4kPath = path.resolve(ARTIFACT_DIR, 'performer_surface_4k_scaled.png');
    await perfPage.screenshot({ path: perf4kPath, fullPage: true });
    console.log(`  -> Performer 4K Surface Saved to: performer_surface_4k_scaled.png`);
    await performerContext.close();

    // Capture Performer Surface on iPad 10.2"
    console.log("Capturing Performer Surface on iPad 10.2\" (810x1080)...");
    const ipadContext = await browser.newContext({
        viewport: { width: 810, height: 1080 },
        hasTouch: true
    });
    const ipadPage = await ipadContext.newPage();
    await ipadPage.goto(`http://127.0.0.1:8080?room=${roomCode}`);
    await ipadPage.waitForTimeout(500);
    await ipadPage.locator('#join-btn').click();
    await ipadPage.waitForTimeout(1000);
    const ipadPerfPath = path.resolve(ARTIFACT_DIR, 'performer_surface_ipad_scaled.png');
    await ipadPage.screenshot({ path: ipadPerfPath, fullPage: true });
    console.log(`  -> Performer iPad Surface Saved to: performer_surface_ipad_scaled.png`);
    await ipadContext.close();

    await browser.close();
    console.log("\nAll multi-viewport captures completed successfully!");
}

run().catch(err => {
    console.error("Capture failure:", err);
    process.exit(1);
});
