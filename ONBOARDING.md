# TDBridge Comprehensive Onboarding & Operations Handbook

Welcome to **TDBridge**! Whether you are a non-technical event producer, a TouchDesigner visual artist, or a frontend web developer, this guide provides the exact workflows, architectural rules, and operational references you need.

---

## 🗺️ Role-Based Navigation

Choose your track below:
- **[Track 1: Non-Technical Show Operator & Event Producer](#track-1-non-technical-show-operator--event-producer)** — Running live shows, managing crowd access, kicking users, and switching scenes.
- **[Track 2: TouchDesigner Artist & Visual Designer](#track-2-touchdesigner-artist--visual-designer)** — Creating new visual scenes, hooking up existing projects in 1 click, and mapping controls.
- **[Track 3: Web & Frontend Developer](#track-3-web--frontend-developer)** — Customizing UI themes, modifying touch ergonomics, adding control archetypes, and extending TypeScript logic.
- **[Track 4: Showcase of Engineered Features](#track-4-showcase-of-engineered-features)** — Tour of vector oscilloscopes, swatch syncing, crowdsourced tap tempo, and dual-code security.
- **[Track 5: TouchDesigner Contract Invariants](#track-5-touchdesigner-contract-invariants)** — Essential engineering rules to prevent performance drops or crashes.

---

## Track 1: Non-Technical Show Operator & Event Producer

### 1. Starting the System
1. Double-click **`Start_System.bat`** in the project folder.
2. The terminal window will open, verify Node.js, compile the code, clear stale network ports, and launch the server.
3. In the terminal, look at the top banner:
   ```text
   =========================================================
     ROOM CODE  >>> [ H J H X ] <<< (Share with audience)
     MASTER KEY >>> [ OP-420066 ] <<< (Private FOH Operator)
     LOCAL URL  : http://127.0.0.1:8080
     TUNNEL URL : https://xxx.trycloudflare.com
   =========================================================
   ```

### 2. Dual-Code Security: What to Share vs What to Keep Private
- **Public Room Code (4 Letters, e.g. `HJHX`):**  
  Display this on your projection screens, LED walls, or venue posters. Attendees scan the QR code or type this code to join. Attendees **cannot** access master controls or disrupt other players.
- **Private Master Key (`OP-XXXXXX`) or Master PIN (`1234`):**  
  Keep this strictly for Front-of-House (FOH) operators and VJs. It unlocks the master control dashboard.

### 3. Accessing the FOH Master Operator Console
You can access the Master Console in three easy ways:
1. **From TouchDesigner:** Click the **`[Open Master Console]`** button on `/project1/TDBridge`. It opens your browser pre-authenticated.
2. **Direct URL:** Open `http://127.0.0.1:8080?key=1234` (or your secret `OP-XXXXXX` key). The key is automatically scrubbed from your browser bar after login for privacy.
3. **From the Mobile Lobby:** Click the discreet **`[ // FOH OPERATOR CONSOLE ]`** button at the bottom of the welcome screen and enter the Master PIN (`1234`).

### 4. Live Show Operations
Inside the FOH Master Console:
- **Global Show Scene Switcher:** Switch between `[01 // AQUARIUM]`, `[02 // PARTICLE CANVAS]`, and `[03 // QR BANNER]`. All audience phones morph their controls live without disconnecting.
- **Scene Parameters Rack:** Tweak live parameters directly from your laptop or iPad (e.g. adjust AI fish swimming speed, change particle trail persistence, trigger food drops or feedback bursts).
- **Connected Performer Roster:** Monitor live attendee handles, assigned slots (`#06` to `#100`), network latency (RTT), and connection uptime.
- **Disruptive Attendee Moderation:** Click **`[DISCONNECT]`** next to any player's name in the table to cleanly boot them from the system.
- **Emergency Cues:**
  - `[RESET ENGINE]`: Restores visual simulation to default.
  - `[PURGE SLOTS]`: Disconnects all connected performers and flushes the stage.

---

## Track 2: TouchDesigner Artist & Visual Designer

### 1. The 1-Click Philosophy: No Manual Wire Dragging
In traditional TouchDesigner setups, connecting a new visual scene requires manually routing dozens of CHOP wires and video cables. In TDBridge, this is completely automated.

### 2. Creating a Brand New Scene in 1 Click
1. Open [`TDBridge.toe`](TDBridge.toe) in TouchDesigner.
2. Select the **`/project1/TDBridge`** component.
3. In the parameter dialog, click the **`[Create Scene Template]`** (`Newscene`) pulse button.
4. TouchDesigner immediately generates a clean, pre-wired Base COMP (e.g. `/project1/3_GenerativeScene`) containing:
   - **`select_bridge` (`selectCHOP`)**: Pre-mapped to all 100 player channels.
   - **Starter Generative Visuals**: Noise, feedback loop, and level adjustments.
   - **`out1` (`outTOP`)**: Pre-wired to the video switcher (`switch_preview`).
5. Double-click inside the new COMP and start building your generative art!

### 3. Hooking Up an Existing Project / COMP
If you already have a TouchDesigner visual system built:
1. Copy or drag your Base COMP into `/project1/` (e.g., `/project1/4_LaserGrid`).
2. Select **`/project1/TDBridge`** and click **`[Audit & Self-Heal Network]`** (`Autolink`).
3. That's it! `scene_manager.py` automatically:
   - Checks if your COMP has an `out1` TOP. If missing, it finds your last TOP and attaches `out1`.
   - Connects `out1` to `/project1/switch_preview`.
   - Checks if your COMP has player data. If missing, it drops `select_bridge` CHOP inside your COMP pointing to `out_players_chop`.
   - Adds your scene to the `Activescene` menu and syncs it to the FOH Master Console.

### 4. How the 3 Pipelines Work

#### A. Video Pipeline (Purple Wires)
- All scenes connect their terminal `out1` TOP into `/project1/switch_preview`.
- The FOH Console and TouchDesigner switch the `switch_preview.par.index` smoothly with zero flicker.

#### B. Control & Player Data Pipeline (Green Wires)
- Inside your scene, `select_bridge` outputs 13 channels per player:
  - Position: `p[1..100]:tx`, `p[1..100]:ty` (normalized `[-1.0, 1.0]`).
  - Buttons: `p[1..100]:b1`, `p[1..100]:b2`, `p[1..100]:b3`, `p[1..100]:b4` (`0.0` or `1.0`).
  - Sliders: `p[1..100]:s1`, `p[1..100]:s2`, `p[1..100]:s3`, `p[1..100]:s4` (`0.0` to `1.0`).
  - Swatch Colors: `p[1..100]:r`, `p[1..100]:g`, `p[1..100]:b` (`0.0` to `1.0`).
  - Status: `p[1..100]:active` (`1.0` if human connected, `0.0` if idle).
- To instance geometry, simply plug `select_bridge` into your `Geometry COMP`'s Instancing page!

#### C. Audio & Crowd Tempo Pipeline
- **Direct Audio Reactivity:** Drop an `Audio Device In CHOP` or `Audio File In CHOP` $\rightarrow$ `Audio Analysis COMP` to extract bass, mid, and high energy. Wire those channels into your geometry or feedback parameters.
- **Crowd Tempo Sync (`tap_rate`):** In Spectator mode, audience members tap the beat on their phones. TDBridge calculates the collective crowd BPM in real-time and streams it into the `tap_rate` column of `players_data`. You can drive particle speeds or strobe pulses directly from the crowd's tempo!

### 5. Choosing Performer Phone Controls (Blueprints)
How do you tell the audience's phones what buttons to display for your scene?
- **Method 1 (No-Code Profile Parameter):** On your scene COMP, add a custom parameter `Profile` (Menu: `Gamepad`, `Touchpad`, `Faderbank`, `Audience`). When your scene is triggered, all phones automatically morph to that layout!
- **Method 2 (Custom Table DAT):** Drop a Table DAT named `ui_blueprint` inside your scene COMP with columns `type`, `id`, `label`, `min`, `max`, `color`. The system reads your table and builds the custom interface live!

### 6. Exposing Custom Parameters to the FOH Master Console
If your scene has custom parameters (e.g. `Speed`, `Scale`, `Turbulence`, `Strobe`):
- Any custom parameter on your scene COMP automatically appears in the FOH Master Console's **Dynamic Scene Parameters Rack**!
- When the operator moves a slider on their iPad or laptop, TDBridge updates `your_comp.par[param]` live via OSC.

---

## Track 3: Web & Frontend Developer

### 1. Technology Stack & Key Files
- **Language:** TypeScript (compiled to ES2020 via `npm run build`).
- **Core Files:**
  - [`src/client/app.ts`](src/client/app.ts): Client state machine, touch pointer capture, vector canvas oscilloscope, dynamic blueprint DOM pool, WebSocket handler.
  - [`public/index.html`](public/index.html): Semantic HTML structure, gate onboarding modal, FOH operator workstation, DOM pool slots.
  - [`public/style.css`](public/style.css): Swiss Graphic Monolith design system tokens, CSS Grid workstation, responsive clamp scaling.
  - [`src/server/relay.ts`](src/server/relay.ts): Node.js WebSocket & OSC supervisor.
  - [`src/server/profiles.ts`](src/server/profiles.ts): Blueprint schemas and sanitization.

### 2. Design System: Swiss Graphic Monolith
The UI adheres strictly to an industrial, high-contrast Swiss Brutalist aesthetic:
- **Zero Gimmicks / Zero Emojis:** All emojis were systematically purged. Status indicators use monospaced ASCII badges (`[01 // IGN]`, `[02 // STRB]`) and hardware vector LED dots.
- **Palette Tokens:**
  - Background: Pure Void Black (`#000000`).
  - Borders: 2px solid Stark White (`#ffffff`) or 1px Dim Muted (`#2a2d34`).
  - Accents: Phosphor Green (`#00ff66`), Signal Cyan (`#00e5ff`), Signal Crimson (`#ff0055`), Amber Gold (`#ffb700`).
- **Typography:**
  - Display & Headings: `Space Grotesk`, `sans-serif`.
  - Telemetry, Badges & Sliders: `JetBrains Mono`, `monospace`.

### 3. Dynamic Blueprint Engine & In-Memory DOM Pool
To guarantee zero frame drops, zero garbage collection pauses, and 100% test compatibility:
- The client does **not** destroy and re-create DOM nodes when profiles swap.
- Instead, it maintains a pre-allocated DOM pool (`#btn-b1` to `#btn-b4` and `#slider-s1` to `#slider-s4`).
- `renderBlueprint(blueprint)` reconfigures the pool's data attributes, titles, ranges, and visibility in a single tick.
- `resetAllControlInputs()` zeros any active pointer capture states on swap to prevent stuck channels.

### 4. Touch & Pointer Ergonomics
- `touch-action: none` and `-webkit-touch-callout: none` are strictly enforced.
- The floating analog joystick uses `setPointerCapture(pointerId)` and `lostpointercapture` hooks to prevent touch escapes when dragging past screen boundaries.
- Tactile feedback triggers `navigator.vibrate(12)` on supported mobile devices.
- Sliders and environment controls use 30Hz `requestAnimationFrame` dampening to prevent network queue congestion.

### 5. Desktop Keyboard Controls
When opened on a desktop PC, the controller automatically supports:
- **WASD / Arrow Keys**: 2D Analog Joystick vector navigation.
- **Keys 1, 2, 3, 4**: Triggers action buttons `b1`, `b2`, `b3`, `b4`.
- **Spacebar**: Strobe / Special action.

---

## Track 4: Showcase of Engineered Features

1. **60Hz Vector Oscilloscope Canvas:**  
   Renders a real-time vector crosshair and phosphorescent green motion-decay trail beneath the joystick puck, providing immediate visual feedback of touch velocity.
2. **8-Hue Stage Swatch Picker:**  
   When onboarding, performers choose from 8 stage colors (Cyan, Magenta, Lime, Amber, Purple, Crimson, Teal, White). This color is transmitted in the join handshake and directly drives the player's RGB geometry instancing in TouchDesigner.
3. **Audience Hype Bus & Live BPM Tap Pulser:**  
   Spectators tap in sync with the live DJ or concert performance. TDBridge calculates rolling average millisecond intervals and streams live venue BPM directly to TouchDesigner.
4. **URL Auto-Login with Privacy Scrubbing:**  
   When opening the Master Console via `?key=1234`, `app.ts` immediately authenticates the session token and invokes `window.history.replaceState({}, document.title, window.location.pathname)`. This ensures private keys never linger in browser history or projector screen URLs.
5. **Zero-Trust Security & Injection Immunity:**  
   Control IDs and environment parameters are filtered through strict regex whitelists (`/^[a-zA-Z0-9_-]{1,16}$/`), prototype pollution vectors (`__proto__`, `constructor`) are blocked with `Object.create(null)`, and IP brute-force lockouts terminate abusive connections after 3 failed attempts.

---

## Track 5: TouchDesigner Contract Invariants

To guarantee 100% stability in production, the following rules must **never** be broken:

| Invariant Rule | Contract Requirement | Why It Must Be Followed |
| :--- | :--- | :--- |
| **Rule 1: Passive FIFO Buffer** | `bridge_osc_in.par.callbacks = ''` | Writing to TouchDesigner DATs inside an OSC callback creates an infinite cook dependency loop that freezes the render engine and drops the UDP port. Draining must occur strictly on `onFrameStart` in `osc_processor`. |
| **Rule 2: Fixed 101-Row DAT Schema** | `players_data` is fixed at exactly 101 rows $\times$ 15 columns. | Dynamic row insertion or deletion causes Replicator COMP stalls and crashes downstream CHOP converters. Row $N$ always represents Slot $N$. |
| **Rule 3: Invariant 13-Channel Union** | `out_players_chop` outputs constant 13 channels $\times$ 100 samples. | Geometry instancing buffers require fixed channel names and memory layouts. Unused channels output `0.0`. |
| **Rule 4: Slot Reservation Model** | Slots 1–5 are reserved for autonomous AI bots; Slots 6–100 are reserved for human performers. | Guarantees the visuals always have vibrant background motion even before the crowd joins the room. |

---

## 🛠️ Verification & Test Suite

Always run the Master Test Suite before committing changes:

```bash
npm test
```

All 9 domains (Unit, Security, Master Console, Telemetry, Remediation, Multi-Player Scenarios, Playwright Headless Browser UI, Multi-Scene Routing, and Self-Healing Network) must exit with code `0`.
