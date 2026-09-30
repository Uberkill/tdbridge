const { chromium } = require('playwright');
const path = require('path');

async function captureShowcase() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set 1440x1000 viewport for high-res desktop capture of the showcase page
    await page.setViewportSize({ width: 1440, height: 1100 });
    
    const fileUrl = 'file:///' + path.resolve(__dirname, 'public', 'swiss_monolith_showcase.html').replace(/\\/g, '/');
    console.log('Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 1. Capture default Mobile View with Gamepad
    console.log('Capturing default showcase...');
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_default_mobile.png'), fullPage: false });

    // 2. Drag joystick puck to produce an active vector & oscilloscope trail
    console.log('Interacting with joystick reticle...');
    const reticle = await page.$('#reticle-boundary');
    if (reticle) {
        const box = await reticle.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.25, { steps: 5 });
            await page.waitForTimeout(200);
            await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_joystick_trail.png') });
            await page.mouse.up();
        }
    }

    // 3. Switch to Tablet View
    console.log('Switching to Tablet View...');
    await page.click('#btn-view-tablet');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_tablet_split.png') });

    // 4. Switch to Latent XY Kaoss Surface
    console.log('Switching to Latent XY Surface...');
    await page.click('button[data-surface="kaoss"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_latent_xy.png') });

    // 5. Switch to VJ Mixer Surface
    console.log('Switching to VJ Mixer Surface...');
    await page.click('button[data-surface="mixer"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_vj_mixer.png') });

    // 6. Switch back to Gamepad & trigger Loading Bar Modal
    console.log('Triggering Loading Bar Fault State...');
    await page.click('button[data-surface="gamepad"]');
    await page.click('#btn-fault-loading');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_fault_loading.png') });
    await page.click('#btn-close-loading');

    // 7. Trigger Signal Loss Disconnect Modal
    console.log('Triggering Signal Loss Disconnect Modal...');
    await page.click('#btn-fault-disconnect');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_fault_disconnect.png') });
    await page.click('#btn-close-disconnect');

    // 8. Trigger Emergency Crash Boundary Modal
    console.log('Triggering Crash Boundary Modal...');
    await page.click('#btn-fault-crash');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_fault_crash.png') });
    await page.click('#btn-crash-close');

    // 9. Cycle ML States
    console.log('Cycling ML States...');
    await page.click('#btn-ml-cycle'); // LATENT LOCK
    await page.waitForTimeout(100);
    await page.click('#btn-ml-cycle'); // STYLE MORPH
    await page.waitForTimeout(100);
    await page.click('#btn-ml-cycle'); // HIGH ENTROPY
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.resolve(__dirname, 'public', 'showcase_ml_high_entropy.png') });

    await browser.close();
    console.log('ALL SHOWCASE SCREENSHOTS CAPTURED SUCCESSFULLY!');
}

captureShowcase().catch(err => {
    console.error('Showcase capture error:', err);
    process.exit(1);
});
