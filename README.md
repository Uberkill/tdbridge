# TDBridge

Low-latency mobile interaction bridge for Derivative TouchDesigner. Turns smartphones into real-time performance controllers over WebSockets and OSC with no app install required.

---

## What It Does

TDBridge allows live audiences to interact directly with TouchDesigner visual systems from their phone browsers:

- **Zero-install entry**: Audience members scan an on-screen QR code or visit a 4-character room URL (`?room=XXXX`).
- **Low latency**: Continuous 60Hz joystick coordinates, triggers, and continuous faders stream over WebSockets to a local Node.js relay, then forward to TouchDesigner over UDP/OSC.
- **Cook-loop immune**: Uses a decoupled FIFO queue in TouchDesigner (`oscinDAT` with empty callbacks, drained atomically on `onFrameStart`) to eliminate recursive cooking freezes.
- **Front-of-House (FOH) operator console**: A covert operator dashboard lets show staff monitor latency, switch scenes, adjust simulation parameters, and moderate players in real time.
- **Modular `.tox` component**: Drop `TDBridge.tox` into any existing TouchDesigner project and connect visual generators via standard CHOP/DAT outputs.

---

## System Architecture

```text
Phones & Tablets (Up to 100 Performers / Spectators)
      │
      ├── [ENTER STAGE] ──── (WebSocket: 60Hz Joystick, Triggers, Sliders)
      └── [OP-ACCESS]   ──── (WebSocket: Private Master Key / PIN)
            │
            ▼  Port 8080 (Local LAN / Cloudflare Tunnel)
┌────────────────────────────────────────────────────────┐
│             Node.js Relay Server (relay.ts)            │
│  - Performer slot allocation (Slots 1-5 bots, 6-100 humans)
│  - Dual-code security (Public room code vs Master key) │
│  - 60Hz rate-limiting and payload validation           │
│  - Performer roster tracking and remote kick           │
│  - Dynamic scene and control profile broadcasting      │
└────────────────────────────────────────────────────────┘
     │ Port 9000 (OSC / UDP)          ▲ Port 9001 (OSC / UDP)
     │ /slot_*, /bridge/*, /env/*     │ /td/fps, /td/scene_list,
     ▼                                │ /td/error, /td/session_name
┌────────────────────────────────────────────────────────┐
│           TouchDesigner Engine (TDBridge.toe)          │
│  - Passive FIFO oscinDAT (callbacks disabled)          │
│  - osc_processor (Execute DAT) draining on onFrameStart│
│  - players_data table (fixed 101 rows x 15 columns)    │
│  - out_players_chop (fixed 13 channels x 100 samples)  │
│  - switch_preview video switcher across active scenes  │
└────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Start the Relay Server
Double-click `Start_System.bat` or run:
```bash
npm install
npm run build
npm start
```
The terminal prints the active room code, master operator key, and local LAN / WAN tunnel URLs:
```text
=========================================================
            TOUCHDESIGNER BRIDGE TERMINAL
=========================================================
  ROOM CODE  >>> [ H J H X ] <<< (Audience Entry)
  MASTER KEY >>> [ OP-420066 ] <<< (FOH Operator)
  LOCAL URL  : http://127.0.0.1:8080
  TUNNEL URL : https://xxx.trycloudflare.com
=========================================================
```

### 2. Open TouchDesigner
Launch `TDBridge.toe` in TouchDesigner 2022+ or 2023+.  
Check `/project1/TDBridge` parameter `Status` to confirm:
```text
[ONLINE // 60.0 FPS]
```

### 3. Connect Devices
- **Performers**: Scan the QR code or open `http://<LAN-IP>:8080?room=HJHX` and tap **ENTER STAGE**.
- **FOH Operator**: Open `http://<LAN-IP>:8080?key=1234` or click `[Open Master Console]` on the `TDBridge` COMP in TouchDesigner.

---

## Output Contracts (`TDBridge.tox`)

When `TDBridge` is running, it exposes standardized outputs to downstream visuals:

### 1. `out_players_chop` (13 Channels x 100 Samples)
- **Channels**: `active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `s3`, `s4`, `tap_rate`, `rot`
- **Slot mapping**: Slots 1–5 are reserved for autonomous ambient bots; slots 6–100 are assigned to human audience members.
- Inactive slots output `0.0` across all channels.

### 2. `out_players_dat` (101 Rows x 15 Columns)
- **Columns**: `slot`, `name`, `active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `tap_rate`, `r`, `g`, `b`
- Row `N` corresponds directly to Slot `N`. Row 0 contains column headers.

### 3. `out_qr_top` (256 x 256 TOP)
- Renders the current 4-character room code, QR code, and event title for projection or secondary display.

### 4. `switch_preview` (Video Switcher TOP)
- Smoothly switches between active scenes (`1_Fishtank`, `2_particle_canvas`, `out_qr_top`, or custom Base COMPs).

---

## Controller Profiles

The web controller adapts dynamically to the active scene:

| Profile | Primary Use Case | Controls Rendered | OSC Output |
| :--- | :--- | :--- | :--- |
| **`gamepad`** | Avatars, vehicles, 2D navigation | Analog vector joystick, 4 action triggers, 2 sliders | `tx, ty, b1..b4, s1..s2` |
| **`touchpad`** | Drawing canvas, particle emitters | 2D trackpad surface, 3 action triggers, 1 brush slider | `tx, ty, b1..b3, s1` |
| **`faderbank`** | VJ / Lighting mixing | 4 vertical faders, 4 flash buttons | `s1..s4, b1..b4` |
| **`audience`** | Spectators, stadium crowds | Tap-tempo BPM pulser, 4 reaction burst pads | `tap_rate, b1..b4` |
| **`custom`** | User-defined | Configured via `ui_blueprint` Table DAT | Dynamic binding |

---

## Project Structure

```text
TDBridge/
├── TDBridge.toe               # TouchDesigner project file
├── TDBridge.tox               # Standalone reusable component
├── TDBridge.toe.toc           # Derivative toe manifest
├── TDBridge.tox.toc           # Derivative tox manifest
├── Start_System.bat           # 1-click Windows launcher
├── package.json               # Node.js dependencies and build scripts
├── tsconfig.json              # TypeScript configuration
├── src/
│   ├── client/
│   │   └── app.ts             # Web controller UI, touch handling, joystick loop
│   └── server/
│       ├── relay.ts           # WebSocket & OSC relay supervisor
│       └── profiles.ts        # Controller blueprints and input sanitization
├── public/
│   ├── index.html             # Client HTML
│   ├── style.css              # Responsive stylesheet (phone, tablet, 4K)
│   └── app.js                 # Compiled client bundle
├── dist/                      # Compiled server bundle
├── core/
│   └── TDBridge.tox           # Core tox package
├── examples/
│   ├── 01_Aquarium/           # Multi-agent interactive fish tank scene
│   └── 02_Particle_Canvas/    # GPU-instanced drawing and particle scene
└── tests/                     # 10-domain automated test suite
```

---

## Automated Verification Suite

Run the full automated test battery:

```bash
npm test
```

The test runner covers all 10 verification domains:
1. Unit & Protocol Validation (Packet parsing, clamp guards)
2. Zero-Trust Security & Injection (Prototype pollution, path traversal, 404 guards)
3. FOH Master Console & Remote Kick (Session token auth, participant moderation)
4. Telemetry & Port Hygiene (REST endpoints, memory leak checks)
5. Engine Invariants (Fixed table dimensions, passive FIFO buffer)
6. Multi-Player Scenarios & Profiles (Concurrency, profile hot-swapping)
7. Headless Browser UI (Playwright DOM tests, touch ergonomics)
8. Multi-Scene Routing (Switch preview, late-joiner synchronization)
9. Self-Healing Architecture & PIN Security (Failover healing, brute-force lockout)
10. Adversarial Chaos & Fuzzing (High-frequency spam, dirty network drops)

---

## License

MIT
