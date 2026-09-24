import { chromium, Browser, Page } from 'playwright';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';

describe('Edge Case E2E Test', () => {
    let browser: Browser;
    let page: Page;
    let wss: WebSocketServer;
    let receivedMessages: any[] = [];
    let serverSocket: WebSocket | null = null;

    beforeAll(async () => {
        wss = new WebSocketServer({ port: 8082 });

        wss.on('connection', (ws) => {
            serverSocket = ws;
            ws.on('message', (message) => {
                const data = JSON.parse(message.toString());
                if (data.type === 'control') {
                    receivedMessages.push(data);
                }
                
                if (data.type === 'join') {
                    ws.send(JSON.stringify({
                        type: 'assigned_slot',
                        slot: 1,
                        ui_blueprint: [
                            { type: 'button', id: 'btn1', label: 'Button 1', color: '#ff0000' },
                            { type: 'button', id: 'btn2', label: 'Button 2', color: '#00ff00' },
                            { type: 'slider', id: 'sld1', label: 'Slider 1', min: 0, max: 100, step: 1, default_val: 50 }
                        ]
                    }));
                }
            });
        });

        browser = await chromium.launch({ headless: true }); // Headless true
        const context = await browser.newContext();
        page = await context.newPage();
        
        await page.addInitScript(() => {
            const OriginalWebSocket = window.WebSocket;
            window.WebSocket = function(url, protocols) {
                if (typeof url === 'string' && url.includes(':8080')) {
                    url = url.replace(':8080', ':8082');
                }
                return new OriginalWebSocket(url, protocols);
            } as any;
            window.WebSocket.prototype = OriginalWebSocket.prototype;
            Object.assign(window.WebSocket, OriginalWebSocket);
        });

    }, 30000);

    afterAll(async () => {
        if (browser) await browser.close();
        if (wss) {
            wss.clients.forEach(c => c.close());
            wss.close();
        }
    });

    test('simulates user connection and chaotic behavior', async () => {
        const indexPath = path.resolve(__dirname, '../public/index.html');
        await page.goto("file://" + indexPath);

        await page.fill('#room-code-input', 'TEST');
        await page.fill('#player-name', 'Player1');
        await page.click('#join-btn');

        await page.waitForSelector('.action-btn', { state: 'visible' });
        
        const buttons = await page.$$('.action-btn');
        expect(buttons.length).toBe(2);
        
        const sliders = await page.$$('input[type="range"]');
        expect(sliders.length).toBe(1);

        receivedMessages = []; 

        const startTime = Date.now();
        
        await page.evaluate(() => {
            const btns = document.querySelectorAll('.action-btn');
            const slider = document.querySelector('input[type="range"]') as HTMLInputElement;

            for (let i = 0; i < 20; i++) {
                const btn = btns[i % 2];
                btn.dispatchEvent(new MouseEvent('mousedown'));
                btn.dispatchEvent(new MouseEvent('mouseup'));
            }

            for (let i = 0; i < 10; i++) {
                slider.value = (Math.random() * 100).toString();
                slider.dispatchEvent(new Event('input'));
            }
        });
        
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(1000);

        await new Promise(resolve => setTimeout(resolve, 500));

        expect(receivedMessages.length).toBe(50);
        
        const noDrops = receivedMessages.length === 50;
        expect(noDrops).toBe(true);

    }, 15000);
});
