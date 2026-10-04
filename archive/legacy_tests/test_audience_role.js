const WebSocket = require('ws');
const http = require('http');

async function test() {
  const room = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:8080/health', r => {
      let b = '';
      r.on('data', d => b += d);
      r.on('end', () => res(JSON.parse(b).room));
    }).on('error', rej);
  });

  const ws = new WebSocket('ws://127.0.0.1:8080');
  await new Promise(res => ws.once('open', res));

  console.log(`Connecting as AUDIENCE with room ${room}...`);
  ws.send(JSON.stringify({ type: 'join', role: 'audience', room, name: 'Audience_Fan' }));
  
  const reply = await new Promise(res => ws.once('message', d => res(JSON.parse(d.toString()))));
  console.log('Audience join reply:', reply);

  // Send an audience hype tap
  console.log('Sending audience hype tap...');
  ws.send(JSON.stringify({ type: 'tap', rate: 128 }));

  await new Promise(r => setTimeout(r, 500));
  ws.close();
  console.log('Audience test complete.');
}

test().catch(console.error);
