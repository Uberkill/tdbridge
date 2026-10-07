# TDBridge Operations & Onboarding Guide

Operational reference for show producers, TouchDesigner visual artists, and web developers working with TDBridge.

---

## Role-Based Navigation

- **[Track 1: Show Operator & Event Producer](#track-1-show-operator--event-producer)** — Launching the system, managing attendee access, moderating slots, and switching scenes.
- **[Track 2: TouchDesigner Visual Artist](#track-2-touchdesigner-visual-artist)** — Scaffolding new scenes, connecting existing networks, and setting event branding.
- **[Track 3: Web & Frontend Developer](#track-3-web--frontend-developer)** — Customizing UI themes, modifying touch ergonomics, responsive tokens, and extending TypeScript logic.
- **[Track 4: TouchDesigner Contract Invariants](#track-4-touchdesigner-contract-invariants)** — Engine rules required to prevent cooking loops and memory spikes.
- **[Track 5: Verification & Testing](#track-5-verification--testing)** — Running the 10-domain quality gate.

---

## Track 1: Show Operator & Event Producer

### 1. Starting the System
1. Double-click `Start_System.bat` in the project root (or run `npm start`).
2. The terminal compiles TypeScript, clears stale ports, and starts the relay:
   ```text
   =========================================================
               TOUCHDESIGNER BRIDGE TERMINAL
   =========================================================
     ROOM CODE  >>> [ H J H X ] <<< (Share with audience)
     MASTER KEY >>> [ OP-420066 ] <<< (Private FOH Operator)
     LOCAL URL  : http://127.0.0.1:8080
     TUNNEL URL : https://xxx.trycloudflare.com
   =========================================================
   ```

### 2. Dual-Code Security
- **Public Room Code (4 characters, e.g. `HJHX`)**: Display on venue projection screens or print on posters. Attendees scan the QR code or enter this code. Public attendees cannot access operator controls.
- **Private Master Key (`OP-XXXXXX`) or Master PIN (`1234`)**: For Front-of-House (FOH) operators only. Unlocks the master management console.

### 3. Setting the Event Title
On `/project1/TDBridge` in TouchDesigner, enter your event name into the **`Sessionname`** parameter (e.g. `MAIN STAGE`). It updates both the mobile welcome header and the stage QR banner live without server restarts.

### 4. Opening the FOH Master Operator Console
Access the Master Console via:
1. **TouchDesigner**: Click `[Open Master Console]` on `/project1/TDBridge`.
2. **Direct Browser**: Open `http://<LAN-IP>:8080?key=1234` (the key is automatically stripped from the URL bar after authentication).
3. **From Mobile/Desktop Gate**: Click the subtle `OP-ACCESS` trigger at the bottom-right corner and enter the Master PIN (`1234`).
4. **Keyboard Shortcut**: Press `Ctrl+Shift+O` or `~` on desktop.

### 5. Live Show Operations
Inside the Master Console:
- **Scene Switcher**: Switch between scenes (`AQUARIUM`, `CANVAS`, `QR`). Connected phones morph controls immediately without disconnecting.
- **Environment Rack**: Adjust live simulation parameters (fish speed, feedback trail persistence, food drops, feedback bursts).
- **Performer Roster**: View connected player handles, assigned slot numbers (`#06` to `#100`), latency (RTT), and connection uptime.
- **Attendee Moderation**: Click `DISCONNECT` next to any player to remove them from the stage.
- **Emergency Cues**:
  - `[RESET ENGINE]`: Restores visual simulation to defaults.
  - `[PURGE SLOTS]`: Disconnects all connected performers and flushes the stage.

---

## Track 2: TouchDesigner Visual Artist

### 1. Scaffolding a New Scene in 1 Click
1. Open `TDBridge.toe` in TouchDesigner.
2. Select `/project1/TDBridge`.
3. Click the **`[Create Scene Template]`** (`Newscene`) pulse button.
4. TouchDesigner generates a clean, pre-wired Base COMP (e.g. `/project1/3_GenerativeScene`) containing:
   - `select_bridge` (`selectCHOP`): Pre-mapped to all 100 player channels.
   - Starter visuals: Noise, feedback loop, and level adjustments.
   - `out1` (`outTOP`): Pre-wired to `switch_preview`.

### 2. Hooking Up an Existing Project COMP
1. Copy your Base COMP into `/project1/` (e.g. `/project1/4_LaserGrid`).
2. Select `/project1/TDBridge` and click **`[Audit & Self-Heal Network]`** (`Autolink`).
3. `scene_manager.py` automatically:
   - Ensures your COMP ends with an `out1` TOP and connects it to `/project1/switch_preview`.
   - Inserts `select_bridge` CHOP inside your COMP pointing to `out_players_chop`.
   - Adds your scene to the `Activescene` menu and syncs it to the operator console.

### 3. Pipeline Breakdown

#### Video Pipeline (TOPs)
All scenes connect their terminal `out1` TOP into `/project1/switch_preview`. The operator console and TouchDesigner switch the `switch_preview.par.index` smoothly.

#### Player Data Pipeline (CHOPs)
Inside your scene, `select_bridge` outputs 13 channels per player:
- Position: `p[1..100]:tx`, `p[1..100]:ty` (normalized `-1.0` to `1.0`)
- Buttons: `p[1..100]:b1`, `p[1..100]:b2`, `p[1..100]:b3`, `p[1..100]:b4` (`0.0` or `1.0`)
- Sliders: `p[1..100]:s1`, `p[1..100]:s2`, `p[1..100]:s3`, `p[1..100]:s4` (`0.0` to `1.0`)
- Colors: `p[1..100]:r`, `p[1..100]:g`, `p[1..100]:b` (`0.0` to `1.0`)
- Status: `p[1..100]:active` (`1.0` when connected, `0.0` when idle)

To instance 3D geometry, wire `select_bridge` directly into your Geometry COMP's Instancing page.

#### Crowd Tempo Pipeline
Collective crowd taps stream into the `tap_rate` channel, allowing music or generative systems to sync to audience rhythm.

---

## Track 3: Web & Frontend Developer

### 1. Key Source Files
- `src/client/app.ts`: Client state machine, touch handling, joystick physics, dynamic blueprint pool, WebSocket loop.
- `public/index.html`: Semantic markup, onboarding card, DOM pool slots.
- `public/style.css`: Fluid token architecture across 5 viewport classes.
- `src/server/relay.ts`: Node.js WebSocket & OSC relay supervisor with heartbeat change guards.
- `src/server/profiles.ts`: Controller profile blueprints and schema sanitization.

### 2. Viewport Breakpoints
In `public/style.css`, five progressive tiers scale the interface:
- **Mobile (< 768px)**: Compact card (`clamp(320px, 92vw, 420px)`), 44px code boxes, 48px action button.
- **Tablet / iPad (768px)**: Card (`clamp(480px, 58vw, 580px)`), 56px code boxes, 56px button.
- **Desktop FHD (1024px)**: Studio card (`clamp(540px, 36vw, 680px)`), 64px code boxes, 60px button.
- **Desktop QHD (1920px)**: Command card (`clamp(660px, 32vw, 800px)`), 76px code boxes, 70px button.
- **Desktop 4K UHD (2560px+)**: Monolith card (`clamp(880px, 28vw, 1100px)`), 108px code boxes, 94px button.

### 3. Desktop Keyboard Controls
When opened in desktop browsers:
- **WASD / Arrow Keys**: 2D analog vector joystick navigation.
- **Keys 1, 2, 3, 4**: Trigger action buttons `b1`, `b2`, `b3`, `b4`.
- **Spacebar**: Special trigger (`b4`).

---

## Track 4: TouchDesigner Contract Invariants

To guarantee production stability, follow these four rules:

| Invariant | Requirement | Rationale |
| :--- | :--- | :--- |
| **Rule 1: Passive FIFO Buffer** | `bridge_osc_in.par.callbacks = ''` | Writing to TouchDesigner DATs inside an OSC callback creates an infinite cook dependency loop that freezes the render engine. Draining occurs strictly on `onFrameStart` in `osc_processor`. |
| **Rule 2: Fixed 101-Row DAT Schema** | `players_data` is fixed at exactly 101 rows x 15 columns. | Dynamic row insertion or deletion causes Replicator COMP stalls and crashes downstream CHOP converters. Row `N` always represents Slot `N`. |
| **Rule 3: Invariant 13-Channel Union** | `out_players_chop` outputs constant 13 channels x 100 samples. | Geometry instancing buffers require fixed channel names and memory layouts. Unused channels output `0.0`. |
| **Rule 4: Slot Reservation Model** | Slots 1–5 are reserved for autonomous AI bots; Slots 6–100 are reserved for human performers. | Guarantees visuals always have background motion even before attendees connect. |

---

## Track 5: Verification & Testing

Always run the test suite before deploying or pushing changes:

```bash
npm test
```

All 10 domains must pass with 0 errors:
1. Unit & Protocol Validation
2. Zero-Trust Security & Injection
3. FOH Master Console & Remote Kick
4. 4-Domain Telemetry & Port Hygiene
5. Engine Remediation & Invariants
6. Multi-Player Scenarios & Profiles
7. Headless Playwright Browser UI
8. Hybrid Multi-Scene & Particle Canvas
9. Self-Healing Architecture & Master PIN
10. Adversarial Chaos & Multi-Project Generalization
