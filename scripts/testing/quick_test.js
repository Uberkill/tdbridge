const WebSocket = require('ws');

const TARGET_URL = "ws://127.0.0.1:8080";
const ROOM_CODE = "UAXQ"; // Current TD room code

console.log(`Testing full integration with ${TARGET_URL}...`);

const ws = new WebSocket(TARGET_URL);

ws.on('open', () => {
    console.log(`[+] Connected. Sending Join...`);
    ws.send(JSON.stringify({ type: 'join', room: ROOM_CODE, name: `Test_Bot` }));
    
    setTimeout(() => {
        console.log(`[+] Moving Joystick...`);
        ws.send(JSON.stringify({ type: 'input', x: 0.5, y: -0.5 }));
    }, 500);

    setTimeout(() => {
        console.log(`[+] Pressing Action 1 (Color)...`);
        ws.send(JSON.stringify({ type: 'button', name: 'action1', state: 1 }));
    }, 1000);
    
    setTimeout(() => {
        console.log(`[+] Pressing Action 2 (Rotate)...`);
        ws.send(JSON.stringify({ type: 'button', name: 'action2', state: 1 }));
    }, 1500);
    
    setTimeout(() => {
        console.log(`[+] Test Complete. Closing.`);
        ws.close();
    }, 2500);
});

ws.on('message', (data) => {
    console.log(`[<] Server: ${data.toString()}`);
});

ws.on('error', (err) => {
    console.error(`[!] Error:`, err.message);
});
