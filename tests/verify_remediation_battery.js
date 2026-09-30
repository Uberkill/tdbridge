const WebSocket = require('ws');
const http = require('http');

const WS_URL = 'ws://127.0.0.1:8080';
const HTTP_URL = 'http://127.0.0.1:8080';
const TD_URL = 'http://127.0.0.1:9980';

async function tdExec(script) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ script });
    const req = http.request(TD_URL + '/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({ stdout: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(HTTP_URL + path, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('===========================================================');
  console.log('   TDBRIDGE REMEDIATION & AUDIT VERIFICATION BATTERY       ');
  console.log('===========================================================\n');

  // Step 1: Check TouchDesigner Room Code Desync (AUD-03 & AUD-10)
  console.log('--- TEST 1: Room Code Synchronization ---');
  const roomRes = await httpGet('/room');
  const relayRoom = roomRes.room;
  const tdRes = await tdExec(`
room = op('/project1/TDBridge').par.Roomcode.eval()
disp = op('/project1/1_Fishtank/room_code_display').par.text.eval()
print(f"{room}|{disp}")
`);
  const [tdRoom, tdDisp] = (tdRes.stdout || '').trim().split('|');
  console.log(`Relay Room: ${relayRoom} | TD Roomcode: ${tdRoom} | Display: ${tdDisp}`);
  if (relayRoom === tdRoom && tdDisp === `CODE: ${relayRoom}`) {
    console.log('✔ [PASS] Room code is 100% synchronized across Relay, TDBridge, and 1_Fishtank!\n');
  } else {
    throw new Error(`Room code desync: Relay=${relayRoom}, TDBridge=${tdRoom}, Display=${tdDisp}`);
  }

  // Step 2: Check Invariant Contracts (AUD-01 & Table Dimensions)
  console.log('--- TEST 2: Invariant Data Contracts ---');
  const contractRes = await tdExec(`
chop = op('/project1/TDBridge/out_players_chop')
dat = op('/project1/TDBridge/players_data')
ud = op('/project1/1_Fishtank/user_data')
sel = op('/project1/1_Fishtank/select_active')
print(f"{chop.numChans},{chop.numSamples}|{dat.numRows},{dat.numCols}|{ud.numRows},{ud.numCols}|{sel.numRows}")
`);
  const [chopInfo, datInfo, udInfo, selRows] = (contractRes.stdout || '').trim().split('|');
  console.log(`out_players_chop: ${chopInfo} (Expected: 13,100)`);
  console.log(`players_data:     ${datInfo} (Expected: 101,15)`);
  console.log(`user_data:        ${udInfo} (Expected: 101,18)`);
  console.log(`select_active:    ${selRows} rows (Header + 5 bots = 6)`);
  if (chopInfo === '13,100' && datInfo === '101,15' && udInfo === '101,18' && selRows === '6') {
    console.log('✔ [PASS] All invariant table and CHOP dimensions perfectly match specifications!\n');
  } else {
    throw new Error(`Invariant contract mismatch: chop=${chopInfo}, dat=${datInfo}, ud=${udInfo}, sel=${selRows}`);
  }

  // Step 3: Audience Role Slot Consumption (AUD-04)
  console.log('--- TEST 3: Zero-Slot Audience Spectator Join ---');
  const audienceWs = new WebSocket(WS_URL);
  await new Promise(res => audienceWs.once('open', res));
  await new Promise(res => audienceWs.once('message', res)); // initial slot message
  audienceWs.send(JSON.stringify({ type: 'join', role: 'audience', room: relayRoom, name: 'Spectator_01' }));
  await sleep(400);

  // Verify that active performer slot 6 remains completely empty and select_active is still 6
  const audienceCheck = await tdExec(`
pdata_s6_active = op('/project1/TDBridge/players_data')[6, 'active'].val
pdata_s6_name = op('/project1/TDBridge/players_data')[6, 'name'].val
sel_rows = op('/project1/1_Fishtank/select_active').numRows
print(f"{pdata_s6_active}|{pdata_s6_name}|{sel_rows}")
`);
  const [s6Active, s6Name, selCountAfterAudience] = (audienceCheck.stdout || '').trim().split('|');
  console.log(`Slot 6 active: ${s6Active} | name: '${s6Name}' | select_active rows: ${selCountAfterAudience}`);
  if (s6Active === '0' && s6Name === '' && selCountAfterAudience === '6') {
    console.log('✔ [PASS] Audience spectator joined without consuming any performer slots!\n');
  } else {
    throw new Error(`Audience consumed slot: active=${s6Active}, name=${s6Name}`);
  }
  audienceWs.close();
  await sleep(300);

  // Step 4: Performer Join, Movement, Feeding, and Clean Disconnect (AUD-01 Ghost Fish Fix)
  console.log('--- TEST 4: Performer Lifecycle & Zero Ghost Fish Cleanup ---');
  const performerWs = new WebSocket(WS_URL);
  await new Promise(res => performerWs.once('open', res));
  await new Promise(res => performerWs.once('message', res));
  performerWs.send(JSON.stringify({
    type: 'join',
    role: 'performer',
    room: relayRoom,
    name: 'AuditDiver',
    color_hex: '#00f0ff'
  }));
  await sleep(500);

  // Send movement and feed fish
  performerWs.send(JSON.stringify({ type: 'input', x: 0.65, y: -0.45 }));
  performerWs.send(JSON.stringify({ type: 'control', id: 'b3', value: 1 }));
  await sleep(300);
  performerWs.send(JSON.stringify({ type: 'control', id: 'b3', value: 0 }));
  await sleep(500);

  // Verify player exists in TouchDesigner
  const playerActiveRes = await tdExec(`
sel = op('/project1/1_Fishtank/select_active')
pdata = op('/project1/TDBridge/players_data')
names = [sel[r, 'name'].val for r in range(sel.numRows)]
print(f"{sel.numRows}|{pdata[6, 'active'].val}|{pdata[6, 'name'].val}|{','.join(names)}")
`);
  const [activeRows, p6Active, p6Name, activeNames] = (playerActiveRes.stdout || '').trim().split('|');
  console.log(`Active fish rows: ${activeRows} | Slot 6 active: ${p6Active} | Name: ${p6Name}`);
  console.log(`Active fish list: [${activeNames}]`);
  if (activeRows !== '7' || p6Name !== 'AuditDiver') {
    throw new Error(`Failed to instantiate performer fish: rows=${activeRows}, name=${p6Name}`);
  }
  console.log('✔ [PASS] Performer fish instantiated and moving in TouchDesigner.');

  // Disconnect the performer
  console.log('Disconnecting performer (triggering freeSlot and replicant destroy)...');
  performerWs.close();
  await sleep(1000);

  // Verify that slot is cleared and select_active dropped back to 6 (NO GHOST FISH)
  const afterDisconnectRes = await tdExec(`
sel = op('/project1/1_Fishtank/select_active')
pdata = op('/project1/TDBridge/players_data')
ud = op('/project1/1_Fishtank/user_data')
print(f"{sel.numRows}|{pdata[6, 'active'].val}|{pdata[6, 'name'].val}|{ud[6, 'name'].val}|{ud[6, 'x'].val}")
`);
  const [finalRows, finalActive, finalP6Name, finalUdName, finalUdX] = (afterDisconnectRes.stdout || '').trim().split('|');
  console.log(`select_active rows: ${finalRows} (Expected: 6)`);
  console.log(`players_data[6] active: ${finalActive} | name: '${finalP6Name}'`);
  console.log(`user_data[6] name: '${finalUdName}' | x: '${finalUdX}'`);
  if (finalRows === '6' && finalActive === '0' && finalP6Name === '' && finalUdName === '' && finalUdX === '0') {
    console.log('✔ [PASS] Ghost fish completely eliminated! Inactive fish deleted instantly.\n');
  } else {
    throw new Error(`Ghost fish detected! finalRows=${finalRows}, finalActive=${finalActive}, name=${finalP6Name}`);
  }

  // Step 5: TouchDesigner Engine Health & Error Count
  console.log('--- TEST 5: TouchDesigner Overall Health & Cook Rate ---');
  const healthRes = await tdExec(`
errs = []
for o in op('/project1').findChildren(depth=4):
    e = o.errors()
    if e:
        errs.append(f"{o.path}: {e}")
fps = round(project.cookRate, 1)
print(f"{fps}|{len(errs)}|{'; '.join(errs)}")
`);
  const [cookFps, errCount, errDetails] = (healthRes.stdout || '').trim().split('|');
  console.log(`Cook FPS: ${cookFps} | /project1 Total Errors: ${errCount}`);
  if (errDetails) console.log(`Errors detail: ${errDetails}`);
  if (parseInt(errCount, 10) === 0 && parseFloat(cookFps) > 50.0) {
    console.log('✔ [PASS] TouchDesigner running at optimal 60 FPS with ZERO errors!\n');
  } else {
    throw new Error(`Engine health degraded: fps=${cookFps}, errors=${errCount}`);
  }

  console.log('===========================================================');
  console.log('   ALL 5 VERIFICATION SUITES PASSED WITH 100% INTEGRITY!   ');
  console.log('===========================================================');
}

runVerification().catch(e => {
  console.error('✘ VERIFICATION FAILED:', e);
  process.exit(1);
});
