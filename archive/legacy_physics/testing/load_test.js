const WebSocket = require('ws');

const TARGET_URL = "ws://127.0.0.1:8080";
const ROOM_CODE = process.argv[2]; // Pass room code as argument
const NUM_CLIENTS = 100;
const SPAM_RATE_MS = 16; // ~60Hz

if (!ROOM_CODE) {
    console.error("Please provide the Room Code as an argument: node load_test.js ABCD");
    process.exit(1);
}

console.log(`Starting Load Test with ${NUM_CLIENTS} simulated mobile phones targeting ${TARGET_URL}...`);

let connectedCount = 0;
let spamIntervals = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
    // Stagger connections to prevent instant handshake blocking
    setTimeout(() => {
        const ws = new WebSocket(TARGET_URL);
        
        ws.on('open', () => {
            connectedCount++;
            console.log(`[+] Phone ${i+1} connected. Total: ${connectedCount}`);
            // Send Join Packet
            ws.send(JSON.stringify({ type: 'join', room: ROOM_CODE, name: `Bot_${i}` }));
            
            // Start spamming joystick data
            const spammer = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'input',
                        x: (Math.random() * 2) - 1, // Random float between -1 and 1
                        y: (Math.random() * 2) - 1
                    }));
                }
            }, SPAM_RATE_MS);
            
            spamIntervals.push(spammer);
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'rejected') {
                console.error(`[-] Phone ${i+1} Rejected: ${msg.reason}`);
                ws.close();
            }
        });

        ws.on('error', (err) => {
            console.error(`[!] Phone ${i+1} Error:`, err.message);
        });
        
        ws.on('close', () => {
            connectedCount--;
        });
        
    }, i * 50); // Stagger by 50ms
}

process.on('SIGINT', () => {
    console.log("Stopping load test...");
    spamIntervals.forEach(clearInterval);
    process.exit();
});
