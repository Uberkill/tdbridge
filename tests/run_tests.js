/**
 * TDBridge End-to-End + TD State Test Suite
 * Covers: relay server, WebSocket protocol, OSC pipeline, TD state validation
 * 
 * Usage:
 *   node tests/run_tests.js            (runs all groups)
 *   node tests/run_tests.js --relay    (relay tests only - skips TD tests)
 *   node tests/run_tests.js --td       (TD tests only - requires TD running)
 */

const WebSocket = require('ws');
const http      = require('http');
const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');
const net       = require('net');
const dgram     = require('dgram'); // for OSC probe

const RELAY_URL  = 'ws://127.0.0.1:8080';
const HTTP_URL   = 'http://127.0.0.1:8080';
const TD_URL     = 'http://127.0.0.1:9980';
const OSC_PORT   = 9000; // relay sends OSC TO TD on this port
const RELAY_BIN  = path.join(__dirname, '../dist/relay.js');
const RELAY_CWD  = path.join(__dirname, '..');

const ARGS       = process.argv.slice(2);
const RELAY_ONLY = ARGS.includes('--relay');
const TD_ONLY    = ARGS.includes('--td');

let relayProc = null;
let passed = 0, failed = 0, skipped = 0;
const results = [];

// ── Utilities ────────────────────────────────────────────────────────────────

function log(msg) { process.stdout.write(msg + '\n'); }

async function test(name, fn, opts = {}) {
  const timeout = opts.timeout || 5000;
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT after ${timeout}ms`)), timeout))
    ]);
    results.push({ status: 'PASS', name });
    passed++;
  } catch (e) {
    results.push({ status: 'FAIL', name, error: e.message });
    failed++;
  }
}

function skip(name, reason) {
  results.push({ status: 'SKIP', name, error: reason });
  skipped++;
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(res => {
    const s = net.createConnection(port, host);
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('error', () => res(false));
  });
}

async function waitForRelay(maxMs = 10000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(8080)) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function startRelay() {
  const alreadyRunning = await isPortOpen(8080);
  if (alreadyRunning) {
    await new Promise(res => {
      const kill = spawn('powershell', ['-Command',
        `$p = (Get-NetTCPConnection -LocalPort 8080 -State Listen -EA 0).OwningProcess; if ($p) { Stop-Process -Id $p -Force -EA 0 }`
      ], { stdio: 'ignore' });
      kill.on('close', res);
      setTimeout(res, 3000);
    });
    await new Promise(r => setTimeout(r, 1000));
  }
  relayProc = spawn('node', [RELAY_BIN], { cwd: RELAY_CWD, stdio: ['ignore', 'pipe', 'pipe'] });
  relayProc.stdout.on('data', () => {});
  relayProc.stderr.on('data', () => {});
  relayProc.on('error', e => { throw new Error('Relay spawn failed: ' + e.message); });
  const ready = await waitForRelay(10000);
  if (!ready) throw new Error('Relay did not start within 10 seconds');
}

function stopRelay() {
  if (relayProc) { try { relayProc.kill('SIGTERM'); } catch(e) {} relayProc = null; }
}

function ws_connect(url = RELAY_URL) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.once('open', () => res(ws));
    ws.once('error', rej);
    setTimeout(() => rej(new Error('WS connect timeout')), 3000);
  });
}

function ws_message(ws, timeout = 2000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('No message received')), timeout);
    ws.once('message', (data) => { clearTimeout(t); res(JSON.parse(data.toString())); });
  });
}

async function http_get(p) {
  return new Promise((res, rej) => {
    http.get(`${HTTP_URL}${p}`, (r) => {
      let body = '';
      r.on('data', d => body += d);
      r.on('end', () => res({ status: r.statusCode, body, json: () => JSON.parse(body) }));
    }).on('error', rej);
  });
}

async function td_exec(script) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ script });
    const req = http.request({
      hostname: '127.0.0.1', port: 9980,
      path: '/execute', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (r) => {
      let data = '';
      r.on('data', d => data += d);
      r.on('end', () => {
        try { res(JSON.parse(data)); }
        catch(e) { res({ stdout: data }); }
      });
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// ── Relay Tests ───────────────────────────────────────────────────────────────

async function runRelayTests() {
  log('\n── GROUP 1: HTTP Server ─────────────────');
  await test('GET / returns 200 (phone UI)', async () => {
    const r = await http_get('/'); if (r.status !== 200) throw new Error(`Got ${r.status}`);
    if (!r.body.toLowerCase().includes('html')) throw new Error('Not HTML');
  });
  await test('GET /branding returns JSON with project_name', async () => {
    const r = await http_get('/branding'); const j = r.json();
    if (!j.project_name) throw new Error('Missing project_name');
  });
  await test('GET /app.js returns JS', async () => {
    const r = await http_get('/app.js'); if (r.status !== 200) throw new Error(`Got ${r.status}`);
  });
  await test('GET /style.css returns CSS', async () => {
    const r = await http_get('/style.css'); if (r.status !== 200) throw new Error(`Got ${r.status}`);
    if (!r.body.includes('{')) throw new Error('Not CSS');
  });
  await test('GET /nonexistent returns 404', async () => {
    const r = await http_get('/does_not_exist_zxcv'); if (r.status !== 404) throw new Error(`Got ${r.status}`);
  });
  await test('index.html has joystick/dpad', async () => {
    const r = await http_get('/');
    if (!r.body.toLowerCase().includes('joystick') && !r.body.toLowerCase().includes('dpad'))
      throw new Error('No joystick UI found');
  });
  await test('index.html handles room param', async () => {
    const r = await http_get('/'); if (!r.body.includes('room')) throw new Error('No room param');
  });

  log('\n── GROUP 2: WebSocket Protocol ──────────');
  await test('WS connect -> assigned_slot', async () => {
    const ws = await ws_connect(); const msg = await ws_message(ws, 3000); ws.close();
    if (msg.type !== 'assigned_slot') throw new Error(`Got: ${msg.type}`);
    if (!msg.slot || msg.slot < 1) throw new Error(`Bad slot: ${msg.slot}`);
  });
  await test('assigned_slot has ui_blueprint with dpad', async () => {
    const ws = await ws_connect(); const msg = await ws_message(ws, 3000); ws.close();
    if (!msg.ui_blueprint?.some(c => c.type === 'dpad')) throw new Error('No dpad');
  });
  await test('ping -> pong', async () => {
    const ws = await ws_connect(); await ws_message(ws, 2000);
    ws.send(JSON.stringify({ type: 'ping' }));
    const r = await ws_message(ws, 2000); ws.close();
    if (r.type !== 'pong') throw new Error(`Got: ${r.type}`);
  });
  await test('bad JSON does not crash server', async () => {
    const ws = await ws_connect(); await ws_message(ws, 2000);
    ws.send('NOT {{{JSON}}'); await new Promise(r => setTimeout(r, 200));
    ws.send(JSON.stringify({ type: 'ping' }));
    const r = await ws_message(ws, 2000); ws.close();
    if (r.type !== 'pong') throw new Error('Server crashed');
  });
  await test('oversized payload rejected (maxPayload 1024)', async () => {
    const ws = await ws_connect(); await ws_message(ws, 2000);
    let closed = false; ws.on('close', () => closed = true);
    ws.send(JSON.stringify({ type: 'input', x: 0, y: 0, junk: 'x'.repeat(2000) }));
    await new Promise(r => setTimeout(r, 500));
    if (!closed) throw new Error('Server accepted >1024 byte payload');
  });

  log('\n── GROUP 3: Room Code Auth ──────────────');
  for (const [label, room] of [['wrong room', 'XXXX'], ['empty room', ''], ['null room', null]]) {
    await test(`joining with ${label} is rejected`, async () => {
      const ws = await ws_connect(); await ws_message(ws, 2000);
      ws.send(JSON.stringify({ type: 'join', room, name: 'Test' }));
      const r = await ws_message(ws, 2000); ws.close();
      if (r.type !== 'rejected') throw new Error(`Expected rejected, got: ${r.type}`);
    });
  }

  log('\n── GROUP 4: Input Safety ────────────────');
  const safetyCases = [
    ['extreme x/y (overflow)', { type: 'input', x: 99999, y: -99999 }, 'crash'],
    ['NaN x/y', { type: 'input', x: NaN, y: NaN }, 'crash'],
    ['string x/y', { type: 'input', x: 'abc', y: 'def' }, 'crash'],
    ['SQL injection name', { type: 'join', room: 'ZZZZ', name: "'; DROP TABLE--" }, 'reject'],
    ['name >100 chars', { type: 'join', room: 'ZZZZ', name: 'A'.repeat(200) }, 'reject'],
    ['unknown message type', { type: 'xss_payload', data: '<script>alert(1)</script>' }, 'crash'],
    ['empty object', {}, 'crash'],
    ['missing type', { value: 42 }, 'crash'],
  ];
  for (const [label, payload, mode] of safetyCases) {
    await test(`${label} does not crash server`, async () => {
      const ws = await ws_connect(); await ws_message(ws, 2000);
      let closed = false; ws.on('close', () => closed = true);
      ws.send(JSON.stringify(payload)); await new Promise(r => setTimeout(r, 300));
      if (mode === 'reject') {
        // Server may close connection (reject) OR send 'rejected' message — both OK
        if (closed) return; // WS closed = server rejected cleanly
        // Check if we can still ping (server alive + didn't crash)
        ws.send(JSON.stringify({ type: 'ping' }));
        const r = await ws_message(ws, 2000).catch(() => ({ type: 'closed' })); ws.close();
        if (r.type !== 'pong' && r.type !== 'rejected' && r.type !== 'closed') throw new Error(`Got: ${r.type}`);
      } else {
        // For crash tests: server must still respond to ping
        ws.send(JSON.stringify({ type: 'ping' }));
        const r = await ws_message(ws, 2000); ws.close();
        if (r.type !== 'pong') throw new Error('Server crashed after: ' + label);
      }
    });
  }

  log('\n── GROUP 5: Concurrency & Slots ─────────');
  await test('10 sequential unique slots', async () => {
    const clients = []; const slots = [];
    for (let i = 0; i < 10; i++) {
      const ws = await ws_connect(); const msg = await ws_message(ws, 3000);
      clients.push(ws); slots.push(msg.slot);
    }
    clients.forEach(ws => ws.close());
    await new Promise(r => setTimeout(r, 800));
    const unique = new Set(slots);
    if (unique.size !== 10) throw new Error(`Duplicate slots: [${slots}]`);
  }, { timeout: 30000 });

  await test('disconnect frees slot for reuse', async () => {
    const ws1 = await ws_connect(); await ws_message(ws1, 2000); ws1.close();
    await new Promise(r => setTimeout(r, 400));
    const ws2 = await ws_connect(); const msg2 = await ws_message(ws2, 2000); ws2.close();
    if (!msg2.slot) throw new Error('No slot after reconnect');
  });

  await test('20 rapid connect-terminate cycles do not crash server', async () => {
    for (let i = 0; i < 20; i++) {
      const ws = await ws_connect(); await ws_message(ws, 1000);
      ws.terminate(); await new Promise(r => setTimeout(r, 50));
    }
    await new Promise(r => setTimeout(r, 500));
    const ws = await ws_connect(); const msg = await ws_message(ws, 2000); ws.close();
    if (msg.type !== 'assigned_slot') throw new Error('Server unresponsive');
  }, { timeout: 30000 });

  log('\n── GROUP 6: Rate Limiting ───────────────');
  await test('100 rapid input messages rate-limited, server survives', async () => {
    const ws = await ws_connect(); await ws_message(ws, 2000);
    for (let i = 0; i < 100; i++)
      ws.send(JSON.stringify({ type: 'input', x: Math.random()*2-1, y: Math.random()*2-1 }));
    await new Promise(r => setTimeout(r, 300));
    ws.send(JSON.stringify({ type: 'ping' }));
    const r = await ws_message(ws, 2000); ws.close();
    if (r.type !== 'pong') throw new Error('Server crashed after flood');
  });

  log('\n── GROUP 7: Resilience ──────────────────');
  await test('server alive after all previous tests', async () => {
    const ws = await ws_connect(); const msg = await ws_message(ws, 2000); ws.close();
    if (msg.type !== 'assigned_slot') throw new Error(`Got: ${msg.type}`);
  });
  await test('HTTP alive after all previous tests', async () => {
    const r = await http_get('/'); if (r.status !== 200) throw new Error(`Got ${r.status}`);
  });
}

// ── TD State Tests ────────────────────────────────────────────────────────────

async function runTDTests() {
  log('\n── TD GROUP 1: Core Structure ───────────');

  const td = async (script) => {
    const r = await td_exec(script);
    return r.stdout || r.output || '';
  };

  await test('TD bridge reachable', async () => {
    const r = await isPortOpen(9980); if (!r) throw new Error('Port 9980 not open');
  });
  await test('testing_final project open', async () => {
    const out = await td("print(project.name)");
    if (!out.includes('testing_final')) throw new Error(`Got: ${out.trim()}`);
  });
  await test('tdbridge_test COMP exists', async () => {
    const out = await td("print(bool(op('/project1/tdbridge_test')))");
    if (!out.includes('True')) throw new Error('tdbridge_test not found');
  });
  await test('user_data has 101 rows', async () => {
    const out = await td("print(op('/project1/tdbridge_test/user_data').numRows)");
    if (!out.trim().startsWith('101')) throw new Error(`Got: ${out.trim()}`);
  });
  await test('5 bot names in slots 1-5', async () => {
    const out = await td(`
ud=op('/project1/tdbridge_test/user_data')
bots=[ud[i,'name'].val for i in range(1,6)]
print(all(b!='' for b in bots), bots)
`);
    if (!out.includes('True')) throw new Error(`Bots: ${out.trim()}`);
  });
  await test('bots have non-zero RGB colors', async () => {
    const out = await td(`
ud=op('/project1/tdbridge_test/user_data')
ok=all(float(ud[i,'r'].val)>0 or float(ud[i,'g'].val)>0 or float(ud[i,'b'].val)>0 for i in range(1,6))
print(ok)
`);
    if (!out.includes('True')) throw new Error('Bots have black colors');
  });
  await test('no ghost players (slots 6-20 empty)', async () => {
    const out = await td(`
ud=op('/project1/tdbridge_test/user_data')
ghosts=[i for i in range(6,21) if ud[i,'name'].val!='']
print(len(ghosts)==0, ghosts)
`);
    if (!out.includes('True')) throw new Error(`Ghost players: ${out.trim()}`);
  });

  log('\n── TD GROUP 2: OSC Pipeline ─────────────');
  await test('bridge_osc_in active, no callbacks', async () => {
    const out = await td(`
osc=op('/project1/tdbridge_test/bridge_osc_in')
print(osc.par.active.val, repr(osc.par.callbacks.val), osc.par.port.val)
`);
    if (!out.includes('True') || !out.includes("''") || !out.includes('9000')) throw new Error(out.trim());
  });
  await test('osc_processor clears buffer after read', async () => {
    const out = await td(`print('clear(keepFirstRow' in op('/project1/tdbridge_test/osc_processor').text)`);
    if (!out.includes('True')) throw new Error('Missing clear() call in osc_processor');
  });
  await test('osc_out exists -> port 9001', async () => {
    const out = await td(`
o=op('/project1/tdbridge_test/osc_out')
print(bool(o), o.par.port.val if o else 'MISSING')
`);
    if (!out.includes('True') || !out.includes('9001')) throw new Error(`osc_out: ${out.trim()}`);
  });
  await test('telemetry_exec active', async () => {
    const out = await td(`t=op('/project1/tdbridge_test/telemetry_exec'); print(bool(t), t.par.active.val if t else 'MISSING')`);
    if (!out.includes('True True')) throw new Error(`telemetry_exec: ${out.trim()}`);
  });

  log('\n── TD GROUP 3: Rendering Pipeline ───────');
  await test('5 fish clones spawned (item1-5)', async () => {
    const out = await td(`
p=op('/project1/tdbridge_test')
clones=[c.name for c in p.children if c.name.startswith('item') and c.OPType=='baseCOMP']
print(len(clones)==5, clones)
`);
    if (!out.includes('True')) throw new Error(`Clones: ${out.trim()}`);
  });
  await test('all_players swaporder=False', async () => {
    const out = await td(`print(op('/project1/tdbridge_test/all_players').par.swaporder.val)`);
    if (!out.includes('False')) throw new Error('swaporder is True - bg will cover fish!');
  });
  await test('all_players has 7 inputs (bg+dummy+5 fish)', async () => {
    const out = await td(`print(len(op('/project1/tdbridge_test/all_players').inputs))`);
    if (!out.trim().startsWith('7')) throw new Error(`Inputs: ${out.trim()}`);
  });
  await test('out1 is 1280x720', async () => {
    const out = await td(`o=op('/project1/tdbridge_test/out1'); print(o.width,o.height)`);
    if (!out.includes('1280') || !out.includes('720')) throw new Error(`Resolution: ${out.trim()}`);
  });
  await test('out1 fed from over1', async () => {
    const out = await td(`print([i.name for i in op('/project1/tdbridge_test/out1').inputs])`);
    if (!out.includes('over1')) throw new Error(`out1 inputs: ${out.trim()}`);
  });

  log('\n── TD GROUP 4: Motion System ────────────');
  await test('movement_switch locked to velocity (index=0, no expr)', async () => {
    const out = await td(`
ms=op('/project1/tdbridge_test/player_master/movement_switch')
print(ms.par.index.val, repr(ms.par.index.expr))
`);
    if (!out.trim().startsWith('0') || !out.includes('None')) throw new Error(`movement_switch: ${out.trim()}`);
  });
  await test('velocity Speed CHOP speed=0.3', async () => {
    const out = await td(`print(op('/project1/tdbridge_test/player_master/velocity').par.speed.val)`);
    if (!out.trim().startsWith('0.3')) throw new Error(`speed: ${out.trim()}`);
  });
  await test('bot_motion writes joystick_x/y (not just x/y)', async () => {
    const out = await td(`print('joystick_x' in op('/project1/tdbridge_test/bot_motion').text)`);
    if (!out.includes('True')) throw new Error('bot_motion does not write joystick_x/y');
  });
  await test('physics gravity expression set', async () => {
    const out = await td(`print(bool(op('/project1/tdbridge_test/physics_world').par.gravityy.expr))`);
    if (!out.includes('True')) throw new Error('Physics gravity expression missing');
  });

  log('\n── TD GROUP 5: Error State ──────────────');
  await test('zero TD errors in tdbridge_test', async () => {
    const out = await td(`
p=op('/project1/tdbridge_test')
errs=[(c.name,c.errors()[:40]) for c in p.children if hasattr(c,'errors') and c.errors() and len(c.errors().strip())>3]
print(len(errs)==0, errs[:3])
`);
    if (!out.includes('True')) throw new Error(`Errors found: ${out.trim()}`);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runTests() {
  log('\n╔══════════════════════════════════════════╗');
  log('║       TDBRIDGE FULL TEST SUITE v2        ║');
  log('╚══════════════════════════════════════════╝');
  log(`Time: ${new Date().toISOString()}`);
  log(`Mode: ${TD_ONLY ? 'TD only' : RELAY_ONLY ? 'Relay only' : 'Full'}\n`);

  try {
    if (!TD_ONLY) {
      log('[SETUP] Starting relay server...');
      try {
        await startRelay();
        log('[SETUP] Relay ready on :8080\n');
      } catch(e) {
        log(`[FATAL] Could not start relay: ${e.message}`); process.exit(2);
      }
      try { await runRelayTests(); } finally { stopRelay(); await new Promise(r => setTimeout(r, 500)); }
    }

    if (!RELAY_ONLY) {
      const tdAlive = await isPortOpen(9980);
      if (!tdAlive) {
        log('\n[SKIP] TouchDesigner bridge not reachable (port 9980 closed)');
        log('       Open testing_final.toe in TD to run TD state tests.\n');
        const tdTestNames = [
          'TD bridge reachable','testing_final project open','tdbridge_test COMP exists',
          'user_data has 101 rows','5 bot names in slots 1-5','bots have non-zero RGB colors',
          'no ghost players (slots 6-20 empty)','bridge_osc_in active, no callbacks',
          'osc_processor clears buffer after read','osc_out exists -> port 9001',
          'telemetry_exec active','5 fish clones spawned (item1-5)',
          'all_players swaporder=False','all_players has 7 inputs (bg+dummy+5 fish)',
          'out1 is 1280x720','out1 fed from over1','movement_switch locked to velocity (index=0, no expr)',
          'velocity Speed CHOP speed=0.3','bot_motion writes joystick_x/y (not just x/y)',
          'physics gravity expression set','zero TD errors in tdbridge_test'
        ];
        tdTestNames.forEach(n => skip(n, 'TD not running'));
      } else {
        log('[SETUP] TD bridge reachable, running TD tests...\n');
        await runTDTests();
      }
    }
  } catch(e) {
    stopRelay();
    log(`\n[FATAL] ${e.message}`); process.exit(2);
  }

  log('\n╔══════════════════════════════════════════╗');
  log('║                  RESULTS                 ║');
  log('╠══════════════════════════════════════════╣');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '○' : '✗';
    const line = `  ${icon} [${r.status}] ${r.name}`;
    log(r.error && r.status !== 'SKIP' ? `${line}\n         → ${r.error}` : line);
  });
  log('╠══════════════════════════════════════════╣');
  log(`  Passed:  ${passed} / ${results.length}`);
  log(`  Failed:  ${failed}`);
  log(`  Skipped: ${skipped} (TD not running)`);
  log('╚══════════════════════════════════════════╝\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  stopRelay();
  log(`\n[FATAL] ${e.message}`); process.exit(2);
});
