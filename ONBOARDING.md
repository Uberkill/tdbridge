# TDBridge Comprehensive Onboarding & Operations Handbook

Welcome to **TDBridge**! Whether you are a non-technical event producer, a TouchDesigner visual artist, or a frontend web developer, this guide provides the exact workflows, architectural rules, and operational references you need.

---

## Role-Based Navigation

Choose your track below:
- **[Track 1: Non-Technical Show Operator & Event Producer](#track-1-non-technical-show-operator--event-producer)** — Running live shows, managing crowd access, kicking users, setting event titles, and switching scenes.
- **[Track 2: TouchDesigner Artist & Visual Designer](#track-2-touchdesigner-artist--visual-designer)** — Creating new visual scenes, hooking up existing projects in 1 click, and setting session branding.
- **[Track 3: Web & Frontend Developer](#track-3-web--frontend-developer)** — Customizing UI themes, modifying touch ergonomics, universal 4K responsive tokens, and extending TypeScript logic.
- **[Track 4: Showcase of Engineered Features](#track-4-showcase-of-engineered-features)** — Tour of vector oscilloscopes, swatch syncing, dynamic session branding, universal scaling, and dual-code security.
- **[Track 5: TouchDesigner Contract Invariants](#track-5-touchdesigner-contract-invariants)** — Essential engineering rules to prevent performance drops or crashes.
- **[Track 6: Codebase Navigation with Graphify](#track-6-codebase-navigation-with-graphify)** — How to traverse the knowledge graph, query subsystems, and explore the interactive architecture map.

---

## Track 1: Non-Technical Show Operator & Event Producer

### 1. Starting the System
1. Double-click **`Start_System.bat`** in the project folder.
2. The launcher opens, compiles code, clears stale ports, and displays the terminal dashboard:
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

### 2. Dual-Code Security: Public vs Private
- **Public Room Code (4 Letters, e.g. `HJHX`):**  
  Display this on your projection screens, LED walls, or venue posters. Attendees scan the QR code or type this code to join. Attendees **cannot** access master controls or disrupt other players.
- **Private Master Key (`OP-XXXXXX`) or Master PIN (`1234`):**  
  Keep this strictly for Front-of-House (FOH) operators and VJs. It unlocks the master control dashboard.

### 3. Setting Your Event Name (Session Branding)
On the `/project1/TDBridge` component in TouchDesigner, type your show name into the **`Sessionname`** parameter (e.g. `MAIN STAGE` or `TOAD LIVE SET`).  
It immediately updates the attendee welcome screen and the stage projection banner with zero restarts.

### 4. Accessing the FOH Master Operator Console
You can access the Master Console in four easy ways:
1. **From TouchDesigner:** Click the **`[Open Master Console]`** button on `/project1/TDBridge`. It opens your browser pre-authenticated.
2. **Direct URL:** Open `http://127.0.0.1:8080?key=1234` (or your secret `OP-XXXXXX` key). The key is automatically scrubbed from your browser bar after login for privacy.
3. **From the Welcome Screen:** Click the discreet **`OP-ACCESS`** micro-trigger at the bottom-right corner of the screen and enter the Master PIN (`1234`).
4. **Keyboard Shortcut:** Press **`Ctrl+Shift+O`** or **`~`** on desktop to summon the operator password prompt.

### 5. Live Show Operations
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
1. Open [`TDBridge.toe`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/TDBridge.toe) in TouchDesigner.
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
- **Direct Audio Reactivity:** Drop an `Audio Device In CHOP` $\rightarrow$ `Audio Analysis COMP` to extract bass, mid, and high energy. Wire those channels into your geometry or feedback parameters.
- **Crowd Tempo Sync (`tap_rate`):** TDBridge calculates collective crowd BPM in real time and streams it into the `tap_rate` column of `players_data`.

### 5. Choosing Performer Phone Controls (Blueprints)
- **Method 1 (No-Code Profile Parameter):** On your scene COMP, add a custom parameter `Profile` (Menu: `Gamepad`, `Touchpad`, `Faderbank`, `Audience`). When your scene is triggered, all phones automatically morph to that layout!
- **Method 2 (Custom Table DAT):** Drop a Table DAT named `ui_blueprint` inside your scene COMP with columns `type`, `id`, `label`, `min`, `max`, `color`. The system reads your table and builds the custom interface live!

---

## Track 3: Web & Frontend Developer

### 1. Technology Stack & Key Files
- **Language:** TypeScript (compiled to ES2020 via `npm run build`).
- **Core Files:**
  - [`src/client/app.ts`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/src/client/app.ts): Client state machine, touch pointer capture, vector canvas oscilloscope, dynamic blueprint DOM pool, WebSocket handler.
  - [`public/index.html`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/public/index.html): Semantic HTML structure, gate onboarding card, covert FOH trigger, DOM pool slots.
  - [`public/style.css`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/public/style.css): Fluid token architecture across 5 viewport classes, CSS Grid workstation, brutalist tokens.
  - [`src/server/relay.ts`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/src/server/relay.ts): Node.js WebSocket & OSC supervisor with heartbeat change guards.
  - [`src/server/profiles.ts`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/src/server/profiles.ts): Blueprint schemas and sanitization.

### 2. Universal Fluid CSS Token System
In `public/style.css`, five progressive media queries scale the interface:
- **Mobile (< 768px):** Compact card (`clamp(320px, 92vw, 420px)`), 44px code boxes, 40px inputs, 48px action button.
- **Tablet / iPad (768px):** Expansive card (`clamp(480px, 58vw, 580px)`), 56px code boxes, 48px inputs, 56px button.
- **Desktop FHD (1024px):** Studio card (`clamp(540px, 36vw, 680px)`), 64px code boxes, 52px inputs, 60px button.
- **Desktop QHD (1920px):** Command card (`clamp(660px, 32vw, 800px)`), 76px code boxes, 60px inputs, 70px button.
- **Desktop 4K UHD (2560px+):** Monolith card (`clamp(880px, 28vw, 1100px)`), 108px code boxes, 84px inputs, 94px button.

### 3. Desktop Keyboard Controls
When opened on a desktop PC, the controller automatically supports:
- **WASD / Arrow Keys**: 2D Analog Joystick vector navigation.
- **Keys 1, 2, 3, 4**: Triggers action buttons `b1`, `b2`, `b3`, `b4`.
- **Spacebar**: Strobe / Special action.

---

## Track 4: Showcase of Engineered Features

1. **Dynamic Session Branding:**  
   Typing an event title into TouchDesigner's `Sessionname` parameter immediately synchronizes the web client title (`#brand-title`) and the stage QR display (`out_qr_top`).
2. **Single-Action Performer Onboarding:**  
   Every attendee enters with a single click: `[ ENTER STAGE -> ]`. No role selectors, no technical jargon.
3. **Covert FOH Operator Access:**  
   The operator trigger is discreetly pinned to the bottom-right corner (`opacity: 0.15`), invisible to general attendees but accessible to staff via hover, click, or `Ctrl+Shift+O` / `~`.
4. **Heartbeat Value-Change Guards:**  
   TouchDesigner's 1Hz failover heartbeat continues uninterrupted while server-side change checks eliminate terminal spam and ring buffer thrashing.
5. **Universal Multi-Device Scaling:**  
   Proportionally scales across iPhone (19.5:9), Android, iPad (4:3), 1080p FHD, and native 4K UHD (3840 $\times$ 2160) displays.
6. **Zero-Trust Security & Injection Immunity:**  
   Control IDs match strict regexes (`/^[a-zA-Z0-9_-]{1,16}$/`), prototype pollution is blocked via `Object.create(null)`, and the Master Console uses strict `textContent`.

---

## Track 5: TouchDesigner Contract Invariants

To guarantee 100% stability in production, the following rules must **never** be broken:

| Invariant Rule | Contract Requirement | Why It Must Be Followed |
| :--- | :--- | :--- |
| **Rule 1: Passive FIFO Buffer** | `bridge_osc_in.par.callbacks = ''` | Writing to TouchDesigner DATs inside an OSC callback creates an infinite cook dependency loop that freezes the render engine. Draining occurs strictly on `onFrameStart` in `osc_processor`. |
| **Rule 2: Fixed 101-Row DAT Schema** | `players_data` is fixed at exactly 101 rows $\times$ 15 columns. | Dynamic row insertion or deletion causes Replicator COMP stalls and crashes downstream CHOP converters. Row $N$ always represents Slot $N$. |
| **Rule 3: Invariant 13-Channel Union** | `out_players_chop` outputs constant 13 channels $\times$ 100 samples. | Geometry instancing buffers require fixed channel names and memory layouts. Unused channels output `0.0`. |
| **Rule 4: Slot Reservation Model** | Slots 1–5 are reserved for autonomous AI bots; Slots 6–100 are reserved for human performers. | Guarantees the visuals always have vibrant background motion even before the crowd joins the room. |

---

## Track 6: Codebase Navigation with Graphify

To quickly inspect or understand the codebase architecture:

1. **View the Interactive Visual Graph:**  
   Open [`graphify-out/graph.html`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/graphify-out/graph.html) in any web browser.
2. **Read the Architectural Audit Report:**  
   Read [`graphify-out/GRAPH_REPORT.md`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/graphify-out/GRAPH_REPORT.md) for community hubs, god nodes, and surprising connections.
3. **Query the Graph from Terminal:**  
   Run breadth-first or depth-first queries on the codebase graph:
   ```bash
   python -m graphify query "How does TouchDesigner ingest OSC without cook loops?"
   python -m graphify query "Where is the FOH Master Console authenticated?"
   ```

---

## Verification & Test Suite

Always run the Master Test Suite before committing changes:

```bash
npm test
```

All 9 domains must pass with 0 errors.
