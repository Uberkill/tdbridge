import { chromium, Browser, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as dgram from 'dgram';

describe('TDBridge E2E Rate Limiting & Flow', () => {
    let browser: Browser;
    let page: Page;
    let relayProcess: ChildProcess;
    let oscListener: dgram.Socket;
    let receivedOSC: any[] = [];
    let roomCode = "";

    beforeAll(async () => {
        // 1. Start a UDP listener on 9000 to catch TouchDesigner OSC packets
        oscListener = dgram.createSocket('udp4');
        oscListener.on('message', (msg) => {
            receivedOSC.push(msg.toString());
        });
        oscListener.bind(9000, '127.0.0.1');

        // 2. Spawn the actual Node.js relay server
        const relayPath = path.resolve(__dirname, '../dist/server/relay.js');
        relayProcess = spawn('node', [relayPath], {
            cwd: path.resolve(__dirname, '..'),
            env: { ...process.env, CI: 'true' }
        });

        // Wait for the server to be ready and extract the Room Code
        await new Promise<void>((resolve, reject) => {
            let ready = false;
            relayProcess.stdout?.on('data', (data) => {
                const str = data.toString();
                if (str.includes('Room Code:')) {
                    // Extract room code using regex
                    const match = str.match(/Room Code:\s*([A-Z0-9]+)/);
                    if (match) {
                        roomCode = match[1];
                        ready = true;
                        resolve();
                    }
                }
            });
            relayProcess.stderr?.on('data', (data) => {
                console.error(`Relay Error: ${data.toString()}`);
            });
            setTimeout(() => {
                if (!ready) reject(new Error("Relay server did not start in time."));
            }, 10000);
        });

        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        page = await context.newPage();
    }, 30000);

    afterAll(async () => {
        if (browser) await browser.close();
        if (oscListener) {
            oscListener.close();
        }
        if (relayProcess) {
            // Send SIGTERM to safely kill relay and its cloudflared child process
            relayProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    });

    test('simulates user connection and verifies debouncing', async () => {
        // Navigate to the ACTUAL served express page, not file://
        await page.goto("http://127.0.0.1:8080", { waitUntil: 'networkidle' });

        await page.fill('#room-code-input', roomCode);
        await page.fill('#player-name', 'E2ETester');
        await page.click('#join-btn');

        await page.waitForSelector('.action-btn', { state: 'visible', timeout: 5000 });
        
        const buttons = await page.$$('.action-btn');
        expect(buttons.length).toBeGreaterThan(0);
        
        receivedOSC = []; 
        const startTime = Date.now();
        
        await page.evaluate(() => {
            const btns = document.querySelectorAll('.action-btn');
            const slider = document.querySelector('input[type="range"]') as HTMLInputElement;

            // Spam identical states (Debouncer should drop these)
            for (let i = 0; i < 20; i++) {
                slider.value = "50";
                slider.dispatchEvent(new Event('input'));
            }

            // Spam real changes
            for (let i = 0; i < 10; i++) {
                slider.value = (Math.random() * 100).toString();
                slider.dispatchEvent(new Event('input'));
            }
        });
        
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(1000);

        await new Promise(resolve => setTimeout(resolve, 500));

        // Because of 60Hz Rate Limiting & State Debouncing, 
        // we should NOT receive all 30 messages. The identical spam (20 messages)
        // should be aggressively dropped, and the 10 changes might be throttled to ~6-10 messages.
        console.log(`Received ${receivedOSC.length} OSC messages after 30 rapid inputs.`);
        
        expect(receivedOSC.length).toBeLessThan(30);
        expect(receivedOSC.length).toBeGreaterThan(0);
    }, 15000);
});
