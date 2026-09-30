const WebSocket = require('ws');
const http = require('http');

async function test() {
  const room = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:8080/room', r => {
      let b = '';
      r.on('data', d => b += d);
      r.on('end', () => res(JSON.parse(b).room));
    }).on('error', rej);
  });

  const ws = new WebSocket('ws://127.0.0.1:8080');
  await new Promise(res => ws.once('open', res));
  await new Promise(res => ws.once('message', res));

  console.log(`[1] Performer joining with room ${room} as 'AuditDiver'...`);
  ws.send(JSON.stringify({
    type: 'join',
    role: 'performer',
    room,
    name: 'AuditDiver',
    color_hex: '#ff0055'
  }));

  await new Promise(r => setTimeout(r, 600));

  console.log('[2] Sending movement inputs & feeding fish...');
  ws.send(JSON.stringify({ type: 'input', x: 0.7, y: -0.3 }));
  ws.send(JSON.stringify({ type: 'control', id: 'b3', value: 1 }));
  await new Promise(r => setTimeout(r, 300));
  ws.send(JSON.stringify({ type: 'control', id: 'b3', value: 0 }));

  await new Promise(r => setTimeout(r, 800));
  console.log('[3] Performer active in stage.');

  // Wait 1.5 seconds so TD script can run while player is connected
  await new Promise(r => setTimeout(r, 1500));

  console.log('[4] Disconnecting Performer...');
  ws.close();

  await new Promise(r => setTimeout(r, 1000));
  console.log('[5] Disconnect sequence complete.');
}

test().catch(console.error);
