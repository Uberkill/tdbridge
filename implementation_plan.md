# Implementation Plan: TDBridge Codebase Audit Remediation & Reliability Hardening (Verified)

## 1. Executive Summary & Goals
This iteration executes a comprehensive remediation of the 50 swallowed exception findings identified by the **Wiggum Codebase Auditor** in `TDBridge` (`C:\Users\oob\.gemini\antigravity\scratch\TDBridge`). 

Following the review by the Verifier subagent, this plan addresses the complete catch inventory, prevents telemetry recursion loops, and installs permanent `.gitignore` defenses against re-pollution.

### Core Remediation Objectives:
1. **Purge Stale Artifacts & Prevent Re-Pollution**:
   - `git rm` stale legacy compiled outputs `src/client/app.js` and `src/server/relay.js`.
   - Update `.gitignore` with `src/**/*.js` and `src/**/*.js.map` so root `tsc` invocations cannot re-pollute `src/`.
2. **Harden Client-Side Reliability (`src/client/app.ts`)**:
   - **`ws.onmessage` Handling (Line 591)**: Catch message processing exceptions with local `console.warn('[WS CLIENT ERROR]', e)` instead of `sendClientTelemetryError` to guarantee zero feedback loops or WS message cascades.
   - **Executable Feature-Detection Handlers**: Every defensive catch block (`wakeLock`, `vibrate`, `sessionStorage`, `pointerCapture`, `replaceState`, `sendClientTelemetryError`) must contain an executable `console.debug(err)` statement to satisfy Wiggum's AST statement auditor.
3. **Exhaustive Server-Side Remediation (`src/server/relay.ts`)**:
   - Remediate **all 35 sites** flagged by the AST auditor:
     - **Centralized Safe Transmission**:
       - `safeUdpSend(msg: any, host?: string, port?: number): boolean` with rate-limited error logging to `addLog` (max 1 log / 5 sec).
       - `safeWsSend(ws: WebSocket | null, payload: string): boolean` with socket state validation and debug logging.
     - **OSC Dispatchers**: Replace all bare `udpPort.send` calls in `sendOSC_Float`, `sendOSC_String`, scene sync, heartbeat, and ping loops with `safeUdpSend`.
     - **Broadcast Loops**: Replace all bare `client.send` loops in `broadcastSceneChange`, `broadcastProfileChange`, `broadcastRoster`, `broadcastSessionUpdate`, and operator kick routines with `safeWsSend`.
     - **Message Handlers**: Wrap UDP message listener (line 452) and WebSocket message router (line 1144) in `addLog('[OSC ERROR] ...')` and `addLog('[WS ERROR] ...')`.
     - **File & Process I/O**: Explicit warning logs on PID creation, log directory creation, and shutdown socket reaping.
4. **Build, Test, and Dashboard Verification**:
   - Recompile client and server bundles: `npm run build`.
   - Execute Wiggum test referee: verify all 10 test domains pass with exit code 0.
   - Run Wiggum codebase auditor: verify 0 high-severity swallowed exceptions remain.
   - Recompile `wiggum_dashboard.html`: verify health score ascends to 90–100%.

---

## 2. Proposed Changes & Architecture

### 2.1 Stale Files & `.gitignore` Protection
- `git rm src/client/app.js src/server/relay.js`
- Add to `.gitignore`:
  ```gitignore
  src/**/*.js
  src/**/*.js.map
  ```

### 2.2 Client-Side Code Changes (`src/client/app.ts`)
- Line 38 (`sendClientTelemetryError`): Catch and log `console.debug('[TELEMETRY] Failed to transmit client error:', e);`.
- Line 169 (`history.replaceState`): Catch and log `console.debug('[ROUTER] replaceState suppressed in sandbox:', e);`.
- Line 410 (`wakeLock.request`): Catch and log `console.debug('[WAKELOCK] Screen wake lock unavailable:', e);`.
- Line 429 & 492 (`sessionStorage`): Catch and log `console.debug('[STORAGE] sessionStorage access failed:', e);`.
- Line 591 (`ws.onmessage`): Catch and log `console.warn('[WS CLIENT ERROR] Message parse or handle failed:', e);` (strictly avoiding recursive WS sends).
- Line 1153 & 1169 (`set/releasePointerCapture`): Catch and log `console.debug('[JOYSTICK] Pointer capture event ignored:', err);`.
- Line 1379 (`navigator.vibrate`): Catch and log `console.debug('[HAPTIC] Device vibration unavailable:', e);`.

### 2.3 Server-Side Code Changes (`src/server/relay.ts`)
- Define `safeUdpSend` with timestamp throttling:
  ```typescript
  let lastUdpErrorLog = 0;
  function safeUdpSend(msg: any, host: string = "127.0.0.1", port: number = OSC_PORT): boolean {
      try {
          udpPort.send(msg, host, port);
          return true;
      } catch (err: any) {
          const now = Date.now();
          if (now - lastUdpErrorLog > 5000) {
              lastUdpErrorLog = now;
              addLog(`[UDP ERROR] Failed to send OSC to ${host}:${port}: ${err?.message || err}`);
          }
          return false;
      }
  }
  ```
- Define `safeWsSend`:
  ```typescript
  function safeWsSend(ws: WebSocket | null, payload: string): boolean {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
          ws.send(payload);
          return true;
      } catch (err: any) {
          recordEvent('WARN', `WebSocket send failed: ${err?.message || err}`);
          return false;
      }
  }
  ```
- Update all 35 catch sites in `relay.ts` to use `safeUdpSend`, `safeWsSend`, or explicit `addLog`/`recordEvent`.

---

## 3. Verification Plan
1. `npm run build` succeeds cleanly with 0 TypeScript compiler errors.
2. `node tests/master_test_runner.js` passes all 10 domains.
3. Wiggum `CodebaseAuditor` confirms 0 swallowed exceptions.
4. `wiggum_dashboard.html` updated with Health Score >90%.
5. Git commit checkpoint on `TDBridge`.
