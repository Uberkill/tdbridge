# Implementation Plan: Dynamic Session Branding, Real Live Telemetry & Sleek Single-Action Gate

## 1. Executive Summary & Design Directives
1. **Dynamic Session Branding from TouchDesigner:**
   - Add custom string parameter **`Sessionname`** (Label: `Session Name`, default: `MAIN STAGE`) to `/project1/TDBridge`.
   - TouchDesigner transmits `/td/session_name <name>` via OSC (port 9001) to the Relay Server.
   - Fallback: Defaults safely to `'TDBRIDGE STAGE'` if TouchDesigner is offline or before first emission.
   - Sanitization & XSS Immunity: `session_name` sanitized (`/[^a-zA-Z0-9 _-]/g`, max 32 chars) and applied strictly via `textContent` (zero `innerHTML`).
   - Live Mutation: When `Sessionname` changes mid-show, Relay broadcasts `{ type: 'session_update', session_name }` to all clients and master consoles.
2. **True Measured Live Telemetry (No Fake Text):**
   - The gate badge (`#gate-telemetry` and `#gate-dot`) is **100% functional and live**:
     - Client queries `/health` on initial load for current TD cook FPS and link status.
     - WebSocket connection streams live RTT and real-time cook FPS.
     - Displays: `[ONLINE // 60.0 FPS]` when connected, or `[OFFLINE]` if disconnected.
     - Dynamic status dot: Green for $\ge 50$ FPS, Amber for $< 50$ FPS, Red for offline.
3. **Compact, Non-Intrusive Stage Color Picker:**
   - Eliminate bulky, competing swatch blocks.
   - Replace with a sleek, low-profile inline palette strip:
     - 8 compact, high-contrast color pills (22px diameter).
     - Automatically picks a random color on initial page load.
     - Synchronized with `[ RANDOM ]` button: rolls a callsign AND a matching neon stage color in one click.
     - Smooth active ring highlight (`box-shadow: 0 0 0 2px #000, 0 0 0 2px var(--color)`).
4. **Single-Action Performer Onboarding (Zero Spectator Bloat):**
   - Completely remove the binary role toggle buttons (`[01 // PERFORMER]` vs `[02 // SPECTATOR]`) and all spectator labels.
   - Single, prominent primary button: **`[ ENTER STAGE → ]`**.
   - Every attendee joins as a full performer with an assigned slot (6–100), avatar, and responsive controller.
   - Clean capacity handling: If all 95 slots are occupied, displays `STAGE FULL // ALL 95 PERFORMER SLOTS ACTIVE` and resets button state gracefully.

---

## 2. Technical Architecture & Phased Execution

### Phase 1: TouchDesigner Session Parameter & OSC Sync (`TDBridge.toe` & `TDBridge.tox`)
1. Append custom parameter `Sessionname` (String, default: `MAIN STAGE`) to `/project1/TDBridge`.
2. In `telemetry_exec` inside TouchDesigner:
   - Emit OSC `/td/session_name` with `parent().par.Sessionname.eval()`.
3. In `room_code_display` TOP (inside `out_qr_top`):
   - Render session name dynamically above or below the QR code.

### Phase 2: Relay Server Ingestion & Broadcast (`src/server/relay.ts`)
1. Maintain `let activeSessionName = 'MAIN STAGE'`.
2. Ingest `/td/session_name` on UDP port 9001:
   - Sanitize: `cleanName = String(val).replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 32) || 'TDBRIDGE STAGE'`.
   - If changed, broadcast `{ type: 'session_update', session_name: activeSessionName }` to all connected clients.
3. Include `session_name: activeSessionName` in:
   - `GET /health` and `GET /telemetry`.
   - `getRosterPayload()`.
   - `assigned_slot` and `master_login_success` WebSocket messages.
4. Default incoming joins to `role = 'performer'` (slots 6–100). Retain backward compatibility for test scripts.
5. Capacity handling: if slots 6–100 are full, reject with clean reason: `STAGE FULL // ALL 95 PERFORMER SLOTS ACTIVE`.

### Phase 3: Frontend Layout & Strict Visual Hierarchy (`public/index.html` & `public/style.css`)
1. **Clean `#gate` Structure:**
   - **Header (Big):**
     - Telemetry pill: `<span class="live-dot" id="gate-dot"></span> <span id="gate-telemetry">CONNECTING...</span>`.
     - Session Title: `<h1 id="brand-title">MAIN STAGE</h1>`.
     - Subtitle: `<p id="brand-subtitle" class="subtitle">LIVE PERFORMANCE SURFACE</p>`.
   - **Section 1: Room Identifier (Medium):**
     - Label: `<div class="section-label">ROOM IDENTIFIER</div>`.
     - 4 segmented boxes (`#code-0` to `#code-3`).
   - **Section 2: Callsign & Color Bar (Medium):**
     - Label row: `<span class="section-label">CALLSIGN & COLOR</span> <button id="random-name-btn" class="text-action-btn">RANDOM</button>`.
     - Input field (`#player-name`) with uppercase auto-formatting.
     - Compact, low-profile horizontal swatch strip (`#palette-swatches`) directly beneath input.
   - **Section 3: Primary Action (Single Big Button):**
     - `<button id="join-btn" class="mono-btn primary-action"><span>ENTER STAGE</span><span class="arrow-glyph">&#8594;</span></button>`.
   - **Section 4: Crew Link (Small):**
     - Discreet footer button: `<button id="open-master-modal-btn" class="text-action-link">[ FOH OPERATOR LOGIN ]</button>`.
2. **CSS Hierarchy & Tokens (`public/style.css`):**
   - Compact swatch styling: 22px diameter circular pills with 6px gaps, active ring `box-shadow: 0 0 0 2px #000, 0 0 0 2px #fff`.
   - Clear contrast between Big (Title/Action), Medium (Inputs), and Small (Telemetry tags).

### Phase 4: Client Logic & Real Telemetry Measurement (`src/client/app.ts`)
1. **Real Telemetry Heartbeat on Gate:**
   - Initial boot query to `/health`:
     - Update `#brand-title` with `data.session_name || 'MAIN STAGE'` strictly via `textContent`.
     - Update `#gate-telemetry` with real TD state (e.g. `[ONLINE // ${data.touchdesigner.cook_fps} FPS]`).
     - Update `#gate-dot` (green for online $\ge 50$ FPS, yellow for $< 50$ FPS, red for offline).
   - Listen for `{ type: 'session_update', session_name }` to update `#brand-title` live without reload.
2. **Synchronized Randomizer:**
   - On initial load: pick random callsign AND random color swatch.
   - Clicking `[ RANDOM ]` rolls a random handle and randomly activates one of the 8 color swatches.
3. **Single Action Join:**
   - `join-btn` dispatches `{ type: 'join', room, role: 'performer', name, color_hex }`.
   - On error or rejection, display error banner, re-enable `join-btn`, and reset text.

### Phase 5: Verification & Automated Quality Gate
1. Compile TypeScript: `npm run build`.
2. Update Playwright tests in `tests/test_playwright_master_ui.js` to assert the single-action gate and dynamic session title.
3. Execute Master Test Suite: `npm test` verifying 9/9 domains pass 100%.
4. Capture Playwright screenshot showing the real session name, functional telemetry dot, and compact color picker.
