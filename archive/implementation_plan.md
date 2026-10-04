# Implementation Plan: Production Hardening & Technical Debt Remediation (V2.6.0)

## 1. Executive Summary & Verification Findings
Following an empirical audit and multi-agent review, suspected platform crashes, client privilege escalation, and scene extensibility limits were confirmed to be **False Flags** (safely handled by existing zero-trust tokens and error guards).

This plan addresses the **Confirmed Real Issues & Technical Debt** with zero risk to TouchDesigner contract invariants:
1. **Unauthenticated Socket Reaper & Telemetry Metric Gap:**
   - Implement the currently unwritten watchdog loop in `relay.ts` (lines 1127–1132) with a 15s timeout, wrapped in defensive `try/catch` with `ws.terminate()` fallback for half-open sockets.
   - Include unauthenticated connections in `GET /telemetry` under `lobby_gate_sockets` and `total_connected_sockets`.
2. **Brute-Force IP Lockout Table TTL Pruning:**
   - Prune expired entries in `masterAuthFailures` once `now >= entry.lockedUntil` and purge inactive partial attempts (>180s) to prevent unbounded Map accumulation.
3. **Configurability via Environment Variables with Invariant Defaults:**
   - Support `parseInt(process.env.WS_PORT || '8080', 10)`, `parseInt(process.env.OSC_PORT || '9000', 10)`, and `parseInt(process.env.OSC_LOCAL_PORT || '9001', 10)`.
   - Update `GET /telemetry` line 121 to reflect dynamic `OSC_LOCAL_PORT` instead of hardcoded 9001.
4. **Repository & Graphify Knowledge Graph Hygiene:**
   - Maintain tracked git status: use `.graphifyignore` (do NOT rename tracked `archive/` directory to avoid dirty git trees).
   - Ignore `.relay.pid`, `scratch_debug/`, and `*.toe.[0-9]*` in `.gitignore`.
5. **Test Harness Adaptability:**
   - Ensure tests in `master_test_runner.js` read the environment variables with defaults to prevent port assertion failures.

---

## 2. Technical Implementation Specifications

### Phase 1: Robust Unauthenticated Socket Reaper & Telemetry Accuracy
**Target File:** `src/server/relay.ts`
1. **Track Socket Ingress Timestamp & Defensive Map Management:**
   - Maintain `const socketConnectedAt = new Map<WebSocket, number>();`.
   - On `wss.on('connection', (ws) => { socketConnectedAt.set(ws, Date.now()); ... })`.
   - On `ws.on('close')`, unconditionally call `socketConnectedAt.delete(ws)`.
   - When a socket transitions to `performer`, `audience`, or `master`, call `socketConnectedAt.delete(ws)`.
2. **Robust 15-Second Idle Watchdog with Half-Open Socket Defense:**
   - In the 2000ms periodic maintenance interval (replacing lines 1126–1132):
     ```typescript
     const now = Date.now();
     for (const ws of unauthenticatedSockets) {
         const connectedTime = socketConnectedAt.get(ws) || 0;
         if (connectedTime > 0 && now - connectedTime > 15000) {
             unauthenticatedSockets.delete(ws);
             socketConnectedAt.delete(ws);
             try {
                 if (ws.readyState === WebSocket.OPEN) {
                     ws.send(JSON.stringify({ type: 'rejected', reason: 'Handshake timeout (15s)' }));
                     ws.close(4008, 'Handshake Timeout');
                 } else {
                     ws.terminate();
                 }
             } catch (e) {
                 try { ws.terminate(); } catch (_) {}
             }
             addLog(`[TIMEOUT] Reaped idle unauthenticated socket after 15s.`);
         }
     }
     ```
3. **Expose Unauthenticated Sockets in Telemetry:**
   - Update line 136 in `GET /telemetry`:
     ```typescript
     total_connected_sockets: slots.filter(s => s.ws !== null).length + audienceSockets.size + masterSockets.size + unauthenticatedSockets.size,
     lobby_gate_sockets: unauthenticatedSockets.size,
     ```

### Phase 2: Instant Cooldown TTL Pruning in `masterAuthFailures`
**Target File:** `src/server/relay.ts`
1. **Track Initial and Subsequent Attempt Times:**
   - In `recordAuthFailure(ip)` (lines 581–595):
     ```typescript
     const entry = masterAuthFailures.get(ip) || { count: 0, lockedUntil: 0, lastAttempt: now };
     entry.lastAttempt = now;
     ```
2. **Immediate Post-Cooldown & Inactivity Pruning:**
   - In the periodic maintenance timer:
     ```typescript
     for (const [ip, entry] of masterAuthFailures.entries()) {
         // Immediate pruning once lockout has expired
         if (entry.lockedUntil > 0 && now >= entry.lockedUntil) {
             masterAuthFailures.delete(ip);
         } 
         // Prune partial failed attempts (1-4 tries) after 3 minutes of inactivity
         else if (entry.lockedUntil === 0 && now - entry.lastAttempt > 180000) {
             masterAuthFailures.delete(ip);
         }
     }
     ```

### Phase 3: Environment Configuration with Telemetry Parity
**Target File:** `src/server/relay.ts`
1. **Integer Parsing with Contract Defaults:**
   ```typescript
   const WS_PORT = parseInt(process.env.WS_PORT || '8080', 10);
   const OSC_PORT = parseInt(process.env.OSC_PORT || '9000', 10);
   const OSC_LOCAL_PORT = parseInt(process.env.OSC_LOCAL_PORT || '9001', 10);
   let ACTIVE_MASTER_PIN = (process.env.MASTER_PIN || '1234').trim();
   ```
2. **Sync Telemetry Schema & OSC Binding:**
   - In `udpPort` instantiation (lines 315–320), set `localPort: OSC_LOCAL_PORT`.
   - In `GET /telemetry` (line 121), replace hardcoded `9001` with `OSC_LOCAL_PORT`:
     ```typescript
     osc_local_port: OSC_LOCAL_PORT,
     ```

### Phase 4: Git-Safe Knowledge Graph & Repository Hygiene
1. **Git-Safe Ignore Configuration:**
   - Create `.graphifyignore` containing:
     ```text
     archive/
     Backup/
     public/app.js
     public/app.js.map
     scratch_debug/
     ```
   - Update `.gitignore` to add:
     ```text
     .relay.pid
     scratch_debug/
     *.toe.[0-9]*
     ```
   - Do **NOT** rename git-tracked `archive/` to `.archive/` to prevent working tree dirt.

### Phase 5: Verification & Automated Regression Testing
1. **Port-Aware Integration Testing:**
   - Create `tests/security/test_idle_reaper_and_ttl.js`:
     - Reads `PORT = process.env.WS_PORT || 8080`.
     - Tests that unauthenticated idle sockets are cleanly closed after 15s.
     - Tests that sockets joining within 15s are not reaped.
     - Tests that `masterAuthFailures` entries are pruned immediately once `now >= lockedUntil`.
     - Verifies `lobby_gate_sockets` in `/telemetry`.
2. **Build & Test Quality Gate:**
   - `npm run build` compiling TypeScript with 0 errors.
   - `npm test` running all 9 domains with 100% pass rate.

---

## 3. Invariant Safety Guarantee
- **Zero Impact on TouchDesigner:** Default ports remain `8080`, `9000`, `9001`. Table schema remains `101x15`, CHOP channels remain `13x100`.
- **Zero Impact on Client Latency:** All timer operations run at low frequency (2000ms) with lightweight iterations ($O(N)$ where $N \le \text{active unauth sockets}$).
