const WebSocket = require('ws');
const http = require('http');

async function getRoom() {
    return new Promise((res, rej) => {
        http.get('http://127.0.0.1:8080/health', (r) => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => res(JSON.parse(d).room));
        }).on('error', rej);
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    const room = await getRoom();
    const ws = new WebSocket('ws://127.0.0.1:8080');

    await new Promise(res => ws.on('open', res));
    ws.send(JSON.stringify({ type: 'join', name: 'LatencyTester', room }));

    await sleep(500);

    const latencies = [];
    for (let i = 0; i < 20; i++) {
        const start = process.hrtime.bigint();
        ws.send(JSON.stringify({ type: 'ping' }));
        await new Promise((resolve) => {
            const onMsg = (msg) => {
                const d = JSON.parse(msg.toString());
                if (d.type === 'pong') {
                    const diffNs = process.hrtime.bigint() - start;
                    const diffMs = Number(diffNs) / 1e6;
                    latencies.push(diffMs);
                    ws.off('message', onMsg);
                    resolve();
                }
            };
            ws.on('message', onMsg);
        });
        await sleep(50);
    }

    ws.close();

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`=== LATENCY MEASUREMENT RESULTS (20 samples) ===`);
    console.log(`Min: ${min.toFixed(2)} ms`);
    console.log(`Avg: ${avg.toFixed(2)} ms`);
    console.log(`Max: ${max.toFixed(2)} ms`);
}

run().catch(console.error);
