# Hardened Implementation Plan: TDBridge Dual-Code Security, Total Emoji Purge & Segregated FOH Master Console

## 1. Executive Summary & Design Directives
Following a multi-agent architectural, penetration, and UI audit (Security Specialist + Industrial UI Architect + Final Reviewer), this implementation plan establishes an enterprise-grade security boundary and a studio-level Swiss Graphic Monolith interface for TDBridge.

### Core Directives:
1. **Zero-Trust Security & Injection Immunity**:
   - Eliminate all possibility of attendees hacking each other, injecting malicious code, spoofing performer slots, or executing unauthorized show cues.
   - Strict whitelisting against OSC path traversal and prototype pollution.
   - Total XSS immunization: zero `innerHTML` rendering of user handles or error strings; strict character sanitization (`[a-zA-Z0-9_-]`) with non-empty fallback (`PLAYER_NN`).
   - Removal of the unauthenticated `/room` leakage endpoint.
   - Cryptographic master key generation (`crypto.randomInt`), WebSocket brute-force lockout with localhost FOH bypass, strictly localhost-bound OSC transmission (`127.0.0.1`), and audience tap rate-limiting.
2. **Total Emoji & Gimmick Purge**:
   - Complete removal of all emojis (`🔥`, `⚡`, `❤️`, `🎉`, `🟢`, `🔴`) across HTML, CSS, client scripts, server logs, and TouchDesigner parameters.
   - Replacement with clean, studio-grade Swiss typography, monospaced ASCII badges (`[01 // IGN]`, `[02 // STRB]`, `[03 // FLUX]`, `[04 // BRST]`), and square CSS hardware LEDs (`.led-online`).
   - Elimination of all cheap AI/smart buzzwords. Staging terminology updated to `AUTOMATED LOAD GENERATORS` / `SYNTHETIC OSC SOURCES`.
3. **Clean Two-Pathway Architecture**:
   - **Pathway A (General Audience / Performer)**: Clean, non-technical lobby with Room Code, User Handle, Swatches, and a binary role selector: `[ 01 // PERFORMER (SLOT) ]` vs `[ 02 // SPECTATOR (HYPE) ]`. Zero master cues or tabs exposed.
   - **Pathway B (FOH Operator)**: Dedicated FOH entryway via discreet `[ // FOH OPERATOR CONSOLE ]` toggle or `/operator` route, locked behind the private Master Key (`OP-XXXXXX`). Does not consume performer slots.

---

## 2. Multi-Agent Security & Industrial Audit Matrix

| Audit Domain | Severity | Existing Flaw | Verified Hardening Fix |
|---|---|---|---|
| **OSC Path Traversal** | **CRITICAL** | `relay.ts:549, 598` interpolates unvalidated `data.id` and `data.param` into `/slot_${num}_${key}` and `/env/${param}`. | Enforce strict whitelist regex `^[a-zA-Z0-9_]{1,16}$` on all incoming control IDs and environment parameters. |
| **Host Privilege Hijack** | **CRITICAL** | `relay.ts:524` accepts `ACTIVE_ROOM_CODE` or hardcoded `'MASTER_KEY'` for host cues. | Remove room code authorization completely. Enforce strict 1:1 binding between the WebSocket connection and a cryptographically generated session token (`masterSockets.get(ws) === token`). |
| **Prototype Pollution** | **HIGH** | `relay.ts:467, 597` indexes `slotStates[slotIndex][key]` on plain `{}`. | Initialize all slot states via `Object.create(null)` and reject keys matching `__proto__`, `constructor`, or `prototype`. |
| **Stored/DOM XSS** | **HIGH** | `relay.ts:577` allows arbitrary characters in handles; `roster-tbody` rendered via dynamic strings. | Sanitize user handles to `/[^a-zA-Z0-9_-]/g`. Provide fallback (`PLAYER_NN`) if sanitized string is empty. Render roster table rows and error logs strictly using `textContent` and `document.createElement`. |
| **Credential Leakage** | **MEDIUM** | `relay.ts:52` exposes `GET /room` returning active room code without authentication. | Remove `GET /room` completely. Room codes must be entered manually or scanned via `?room=XXXX` query parameter. |
| **Brute-Force & DoS** | **HIGH** | Insecure `Math.random()` key generation; no rate-limiting on `master_login` or audience tap spam. | Generate 6-digit keys via `crypto.randomInt(100000, 999999)` (`OP-XXXXXX`). Implement IP rate limiter (max 5 failed attempts/min = 60s lockout, localhost exempt) and clamp audience taps to $\le 10$ packets/sec. |
| **OSC Eavesdropping** | **HIGH** | Master key broadcast over unencrypted network UDP. | Explicitly enforce `127.0.0.1` destination on `/bridge/master_code` transmission. |
| **Visual Gimmicks** | **AESTHETIC** | Cheap emojis (`🔥`, `⚡`, `❤️`, `🎉`, `🟢`, `🔴`) and "AI demo agent" terminology. | Purge all emojis. Replace with Swiss monospaced hardware tags (`[01 // IGN]`, `[02 // STRB]`) and ASCII status badges (`[ONLINE // 60.0 FPS]`). |

---

## 3. Dual-Code Architecture & Clean User Flow

```
                                    +--------------------------------------------------+
                                    |         TOUCHDESIGNER BRIDGE TERMINAL            |
                                    |  [ROOM CODE]  >>> [ B Y C F ] <<<  (Public)      |
                                    |  [MASTER KEY] >>> [ OP-749281 ] <<< (Private FOH)|
                                    +--------------------------------------------------+
                                             |                               |
                   +-------------------------+                               +-------------------------+
                   |                                                                                   |
                   v (Public Venue Screen / QR Code)                                                   v (Private FOH Booth)
      +--------------------------+                                                        +--------------------------+
      |  PATHWAY A: GENERAL USER |                                                        |  PATHWAY B: FOH OPERATOR |
      |   (Phone / Spectators)   |                                                        |   (FOH Laptop / iPad)    |
      +--------------------------+                                                        +--------------------------+
      |  Room Code: [ B Y C F ]  |                                                        |  Room Code:  [ B Y C F ] |
      |  Handle:    [ VECTOR_42] |                                                        |  Master Key: [OP-749281] |
      |  Role: [PERFORMER/HYPE]  |                                                        +--------------------------+
      |  Palette:   [ CYAN     ] |                                                                     |
      +--------------------------+                                                                     v (Handshake)
                   |                                                                      +--------------------------+
                   v (Connect)                                                            |  MASTER BROADCAST PANEL  |
      +--------------------------+                                                        |  - Scene Switcher        |
      |   INTERACTIVE SURFACE    |                                                        |  - Emergency Stage Cues  |
      |  - 60Hz Analog Reticle   |                                                        |  - Live Performer Roster |
      |  - 4 Hardware Triggers   |                                                        |  - Profile Hot-Swapper   |
      |  - Dual Precision Faders |                                                        |  - 4-Domain Telemetry    |
      |  * ZERO Master Cues *    |                                                        |  * 0 Slot Consumption *  |
      +--------------------------+                                                        +--------------------------+
```

---

## 4. Phased Implementation Roadmap

### Phase 1: Relay Server Hardening & Security Core (`src/server/relay.ts`)
1. **Remove Insecure Endpoints & Sanitize Codes:**
   - Remove `app.get('/room')`.
   - Generate `ACTIVE_ROOM_CODE` and `ACTIVE_MASTER_KEY = 'OP-' + crypto.randomInt(100000, 999999);`.
   - Update terminal dashboard to display clean ASCII banners:
     ```
     =========================================================
                  TOUCHDESIGNER BRIDGE TERMINAL               
     =========================================================
     [NETWORK]    Status:          [ONLINE - CLOUDFLARE]
     [URL]        Public Address:  https://...trycloudflare.com
     [LOCAL]      Local LAN:       http://127.0.0.1:8080
     ---------------------------------------------------------
     [ROOM CODE]  >>>  [ B Y C F ]  <<<   (Public - Crowd Entry)
     [MASTER KEY] >>>  [ OP-749281 ] <<<  (PRIVATE - FOH Console Only)
     ---------------------------------------------------------
     ```
   - Stream `/bridge/master_code [ACTIVE_MASTER_KEY]` in 1000ms heartbeat loop strictly to `127.0.0.1` (localhost only).
2. **Defensive Input Validation & Prototype Protection:**
   - Initialize `slotStates[i] = Object.create(null)`.
   - Whitelist control IDs: `const VALID_CONTROL_ID = /^[a-zA-Z0-9_-]{1,16}$/;`. Reject anything invalid or matching `__proto__`, `constructor`, `prototype`.
   - Whitelist environment params: `const VALID_ENV_PARAM = /^[a-zA-Z0-9_]{1,24}$/;`.
   - Sanitize names: `let cleanName = String(data.name || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 12);`
     `if (!cleanName) cleanName = 'PLAYER_' + playerNum;`.
3. **Session-Bound Master Authentication:**
   - In `ws.on('message')`, handle `{ type: 'master_login', room, key, resume_token }`:
     - Rate-limit failed attempts: $\le 5$ failures per IP per 60s (with `127.0.0.1` / `::1` localhost bypass). Lockout response: `{ type: 'master_auth_rejected', reason: 'RATE_LIMIT_LOCKOUT' }`.
     - Generate cryptographic session token via `crypto.randomBytes(24).toString('hex')`.
     - Bind socket in `masterSockets = new Map<WebSocket, string>()` and `masterTokens = new Set<string>()`.
     - Assign `slotIndex = -1` (0 performer slot consumption, 0 clones created).
   - In `ws.on('close')`, evict from `masterSockets`.
4. **Strict Host Command Authorization:**
   - For `data.type === 'host_command'`: strictly require `masterSockets.get(ws) === data.token`. Reject all others with `UNAUTHORIZED HOST ACTION`.
5. **Live Roster Streaming & Kick Handler:**
   - `broadcastRoster()` emits `{ type: 'roster_update', roster: [...] }` to all authenticated `masterSockets`.
   - `action === 'kick_slot'`: terminates target socket with code `4003` (`KICKED_BY_OPERATOR`), frees slot, synchronously resets `slotStates[i] = Object.create(null)`, and emits zeroing OSC.
6. **Audience Tap Throttling:**
   - Rate limit audience tap packets to max 10 packets/second per socket to prevent UDP queue overflow.

### Phase 2: TouchDesigner Parameter Sync (`TDBridge.toe` & `TDBridge.tox`)
1. **Custom Parameter `Mastercode`:**
   - Append string parameter `Mastercode` (label: "FOH Master Key") on `/project1/TDBridge`.
2. **Heartbeat OSC Ingestion:**
   - In `osc_processor`, parse `/bridge/master_code` and update `parent().par.Mastercode`.
3. **Status String Emoji Purge:**
   - In `telemetry_exec`: replace `🟢 ONLINE` / `🔴 OFFLINE` with `[ONLINE]` / `[OFFLINE]`.

### Phase 3: Frontend UX Overhaul & Complete Emoji Purge (`public/index.html`, `public/style.css`, `src/client/app.ts`)
1. **Lobby Redesign (`#gate`):**
   - Binary role toggle: `[ 01 // PERFORMER (SLOT) ]` and `[ 02 // SPECTATOR (HYPE) ]`.
   - Remove `MASTER (OPERATOR)` completely from gate role selector.
   - At the bottom of the card, add clean monospaced toggle: `[ // FOH OPERATOR CONSOLE ]`.
2. **Master Authentication Modal:**
   - Brutalist high-contrast modal:
     - Header: `// FOH MASTER AUTHENTICATION`
     - Room Code (prefilled from URL or manual)
     - Master Key Input (`type="password"`, placeholder: `ENTER OP-XXXXXX`)
     - Button: `[ AUTHENTICATE MASTER SESSION ]`
3. **General Surface Cleanliness (`#ui`):**
   - Remove the `01 // PERFORMER`, `02 // MASTER CONSOLE`, `03 // AUDIENCE HYPE` tab bar completely.
   - General performers only see their controller (joystick, actions, sliders).
   - Spectators only see their hype dashboard.
4. **Complete Emoji Purge in Audience Dashboard:**
   - Replace reaction emoji tiles with Swiss vector typography:
     - `[01 // IGN]` (Ignite / Pulse)
     - `[02 // STRB]` (Strobe / Flash)
     - `[03 // FLUX]` (Flux / Flow)
     - `[04 // BRST]` (Burst / Energy)
5. **Secure Dedicated Master Console (`#master-ui`):**
   - Renders only upon receiving `master_auth_success`.
   - Persists session token in `sessionStorage` for page refresh resilience.
   - Performer Roster Table: built strictly via `document.createElement` and `textContent` (100% XSS proof). Includes live slot, handle, color swatch, ping RTT, and `[ KICK ]` button.
   - Global Scene Switcher (`AQUARIUM`, `CANVAS`, `KINETIC`).
   - Emergency Cues (`RESET ENGINE`, `PURGE ALL SLOTS`).
   - Live 4-Domain Telemetry HUD.

---

## 5. Verification & Penetration Acceptance Battery
1. **Penetration & Security Test Suite (`tests/test_master_security.js`):**
   - **XSS & Injection**: Attempt injection payloads in handle (`<script>`, `<img src=x onerror=...>`) and control IDs (`__proto__`, `../../reset`). Verify sanitized, defaulted to `PLAYER_N`, and neutralized.
   - **Host Command Unauthorized Rejection**: Verify sending host commands with room code, hardcoded strings, or empty tokens fails with 401.
   - **Brute-Force Lockout**: Execute 6 rapid invalid master login attempts; verify 6th attempt is rejected with `RATE_LIMIT_LOCKOUT`.
   - **Zero Slot Consumption**: Verify connecting as master leaves `allocated_clones` and performer slots unchanged.
   - **Kick Lifecycle**: Connect a mock performer; trigger `kick_slot` from master; verify performer receives close code `4003` and slot frees.
2. **Emoji Audit**: Grep across all source files (`index.html`, `style.css`, `app.ts`, `relay.ts`, `TDBridge.toe`) confirming 0 emojis remain.
3. **TouchDesigner Invariants**:
   - `players_data`: exactly 101 rows x 15 columns.
   - `out_players_chop`: exactly 13 channels x 100 samples.
   - 0 errors under `/project1`.
4. **Unified Regression Suite**: Run `npm test` verifying all 5 existing test suites pass.
