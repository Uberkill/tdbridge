const WebSocket = require('ws');
const ws = new WebSocket("ws://127.0.0.1:8080");
ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'join', room: 'UAXQ', name: `Test_Bot` }));
    ws.send(JSON.stringify({ type: 'input', x: 0.5, y: -0.5 }));
});
// keep alive
setInterval(() => {}, 1000);
