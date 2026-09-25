"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const dgram = __importStar(require("dgram"));
describe('TDBridge E2E Rate Limiting & Flow', () => {
    let browser;
    let page;
    let relayProcess;
    let oscListener;
    let receivedOSC = [];
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
        relayProcess = (0, child_process_1.spawn)('node', [relayPath], {
            cwd: path.resolve(__dirname, '..'),
            env: { ...process.env, CI: 'true' }
        });
        // Wait for the server to be ready and extract the Room Code
        await new Promise((resolve, reject) => {
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
                if (!ready)
                    reject(new Error("Relay server did not start in time."));
            }, 10000);
        });
        browser = await playwright_1.chromium.launch({ headless: true });
        const context = await browser.newContext();
        page = await context.newPage();
    }, 30000);
    afterAll(async () => {
        if (browser)
            await browser.close();
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
            const slider = document.querySelector('input[type="range"]');
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
