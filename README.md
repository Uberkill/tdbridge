# TDBridge: High-Concurrency Mobile & Show Control System for TouchDesigner

Zero-install, broadcast-grade mobile controller and front-of-house (FOH) show control pipeline for Derivative TouchDesigner. Turns audience smartphones into low-latency interactive performance controllers over WebSockets, routed via high-frequency local OSC/UDP with 100% cook-loop immunity.

---

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    NETWORK INGRESS                                     │
│                                                                                        │
│   Smartphones & Tablets (Up to 100 Performers / Mobile, iPad & Desktop 4K)            │
│        │                                                                               │
│        ├── [ ENTER STAGE -> ] ─── (WebSocket: 60Hz Joysticks, Triggers, Sliders)       │
│        └── [ OP-ACCESS ] (Hidden)  (WebSocket: Secure Master Key / 4-Digit PIN)       │
│                                                                                        │
│                     │                                                                  │
│                     ▼  Port 8080 (Local LAN / Cloudflare Tunnel)                       │
│   ┌──────────────────────────────────────────────────────────────────┐                 │
│   │               Node.js Relay Supervisor (relay.ts)                │                 │
│   │  • Single-Action Performer Ingress (Slots 6–100 humans, 1–5 bots)│                 │
│   │  • Dual-Code Security (Public Room Code vs Private Master Key)   │                 │
│   │  • Rate-Limiting & Anti-Flooding (60Hz clamp, Brute-Force Defense)│                │
│   │  • Heartbeat Change-Detection Guards (Zero Telemetry Spam)       │                 │
│   │  • Live Performer Roster & Remote Kick Engine                    │                 │
│   │  • Dynamic Session Branding & Blueprint Registry                 │                 │
│   └──────────────────────────────────────────────────────────────────┘                 │
│              │                                        ▲                                │
│   OSC / UDP  │ Port 9000                   OSC / UDP  │ Port 9001                      │
│   (/slot_*,  │ (/env/*,                    (/td/fps,  │ (/td/scene_list,               │
│    /bridge/*)│  /bridge/scene)              /td/error)│  /td/scene_health,             │
│              │                                        │  /td/session_name)             │
│              ▼                                        │                                │
│   ┌──────────────────────────────────────────────────────────────────┐                 │
│   │               TouchDesigner Engine (TDBridge.toe)                │                 │
│   │  • Passive FIFO oscinDAT (bridge_osc_in with callbacks='')       │                 │
│   │  • Atomic Frame Drain via osc_processor (Execute DAT)            │                 │
│   │  • Invariant Contracts: players_data (101x15) & out_players_chop │                 │
│   │  • Self-Healing Scene Engine & 1-Click Template Scaffolding      │                 │
│   │  • switch_preview Video Switcher & Multi-Scene Routing           │                 │
│   │  • Sessionname Parameter & Stage QR Banner (out_qr_top)          │                 │
│   └──────────────────────────────────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

- **Single-Action Performer Onboarding (`[ ENTER STAGE -> ]`):**
  - Streamlined attendee onboarding: no role confusion or technical choices. Every attendee joins directly as a full interactive Performer (slots 6–100) with their own avatar and controller.
  - Strict visual hierarchy: Event Name hero $\rightarrow$ 4-digit room code $\rightarrow$ Handle & Stage Palette $\rightarrow$ Primary Action.
- **Universal Multi-Device Scaling (iPhone to 4K UHD):**
  - Fluid CSS token architecture dynamically scales the entire UI across modern smartphone ratios (iPhone 19.5:9, Android ~20:9), tablets (iPad 4:3), FHD (1080p), and native 4K UHD displays (3840 $\times$ 2160).
  - Eliminates "tiny card" syndrome on high-resolution screens while guaranteeing touch ergonomics on mobile.
- **Dynamic Event Branding from TouchDesigner:**
  - Artists define the event title directly in TouchDesigner via the `Sessionname` custom parameter (e.g. `MAIN STAGE` or `TOAD LIVE`).
  - Broadcasts via OSC `/td/session_name` to sync the mobile gate header (`#brand-title`) and the stage QR display (`out_qr_top`).
- **Covert Front-of-House (FOH) Access:**
  - Replaces intrusive operator buttons with an unobtrusive `OP-ACCESS` micro-trigger at the bottom-right corner (`opacity: 0.15`), accessible via hover/click or keyboard shortcuts (`Ctrl+Shift+O`, `~`).
  - Dedicated FOH Master Console (`#master-ui`) features real-time attendee roster with kick triggers, global scene switcher, and scene-adaptive environment controls.
- **Dual-Code Security Architecture:**
  - **Public Room Code (4 characters, e.g. `HJHX`):** Displayed on screen/QR for attendee entry. Performers cannot access master broadcast controls.
  - **Private Master Key (`OP-XXXXXX`) or 4-Digit PIN (`1234`):** Displayed strictly in the operator terminal and TouchDesigner custom parameters.
- **Telemetry & Heartbeat Stability:**
  - TouchDesigner broadcasts a 1Hz failover heartbeat (`/bridge/master_pin`, `/td/scene_list`).
  - Server-side value-change guards prevent terminal thrashing, redraw spam, and ring buffer eviction.
- **Self-Healing Scene Engine:**
  - `[Audit & Self-Heal Network]`: Automatically scans `/project1` for scene COMPs, attaches `select_bridge` (`selectCHOP`) for player data, and wires video `out1` (`outTOP`) to `switch_preview`.
  - `[Create Scene Template]`: Instantly scaffolds a new generative Base COMP in 1 click.
- **Swiss Graphic Monolith Design System:**
  - High-contrast pure black (`#000000`) and precision industrial borders (`#222226` / `#ffffff`).
  - Space Grotesk display typography and JetBrains Mono telemetry. Zero emojis.

---

## 3. Quick Start

### Step 1: Launch System
Double-click **`Start_System.bat`** (or run `npm start` in terminal).  
The launcher verifies Node.js, clears stale network ports, compiles TypeScript, initializes Cloudflare tunnel, and prints the terminal dashboard:

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

### Step 2: Open TouchDesigner
Launch **`TDBridge.toe`** in TouchDesigner.  
Confirm that the status parameter on `/project1/TDBridge` displays:
```text
[ONLINE // 60.0 FPS]
```

### Step 3: Connect Devices
- **Attendees:** Scan the on-screen QR code (or visit `http://127.0.0.1:8080?room=HJHX`) and click **`[ ENTER STAGE -> ]`**.
- **Show Operator:** Visit `http://127.0.0.1:8080?key=1234` (or click `[Open Master Console]` on the `TDBridge` COMP in TouchDesigner) to access the FOH Master Console.

---

## 4. TouchDesigner Output Contracts (`TDBridge.tox`)

When `TDBridge` is active, it exposes standardized outputs:

1. **`out_players_chop` (13 Channels $\times$ 100 Samples):**
   - Channels: `active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `s3`, `s4`, `tap_rate`, `rot`.
   - Inactive player slots output `0.0`.
   - Slots 1–5 are reserved for autonomous bots / ambient particles; Slots 6–100 are reserved for human performers.
2. **`out_players_dat` (101 Rows $\times$ 15 Columns):**
   - Columns: `slot`, `name`, `active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `tap_rate`, `r`, `g`, `b`.
   - Row $N$ directly corresponds to Slot $N$.
3. **`out_qr_top` (256 $\times$ 256 TOP):**
   - Displays the room code, QR code, and dynamic event name for crowd onboarding.
4. **`switch_preview` (Video Switcher TOP):**
   - Seamlessly switches video between active scenes (`1_Fishtank`, `2_particle_canvas`, `out_qr_top`, or custom scenes).

---

## 5. Controller Profiles & Blueprints

| Profile | Target Scene | Primary Controls | OSC Channels |
| :--- | :--- | :--- | :--- |
| **`gamepad`** | Interactive Avatars (Aquarium) | Vector Joystick, 4 Action Triggers, 2 Sliders | `tx, ty, b1..b4, s1..s2` |
| **`touchpad`** | Generative Drawing (Particle Canvas) | 2D Canvas Surface, 3 Triggers, Brush Slider | `tx, ty, b1..b3, s1` |
| **`faderbank`** | Audio/Visual Mixing | 4 Vertical Mixers, 4 Flash Triggers | `s1..s4, b1..b4` |
| **`audience`** | Crowd Participation / Spectator Failover | BPM Tap Pulser, 4 Reaction Burst Pads | `tap_rate, b1..b4` |
| **`custom`** | Artist Defined | Dynamic Table DAT (`ui_blueprint`) | Dynamic binding |

---

## 6. Codebase Knowledge Graph (Graphify)

A complete architectural knowledge graph is maintained in `graphify-out/`:

- **Interactive Visualizer:** Open `graphify-out/graph.html` in any browser to explore the visual node graph.
- **Graph Data:** `graphify-out/graph.json` contains raw node and edge definitions across all subsystems.
- **Architectural Audit Report:** `graphify-out/GRAPH_REPORT.md` details community clusters, god nodes, and cross-subsystem bridges.
- **Query the Graph:** Run `python -m graphify query "<question>"` to traverse the codebase knowledge graph.

---

## 7. Verification & Automated Test Suite

Run the full unified Master Test Suite covering all 9 system domains:

```bash
npm test
```

```text
====================================================================
            TDBRIDGE MASTER TEST EXECUTION SUMMARY              
====================================================================
  [PASS] [01] DOMAIN 1: UNIT & PROTOCOL VALIDATION
  [PASS] [02] DOMAIN 2: ZERO-TRUST SECURITY & INJECTION
  [PASS] [03] DOMAIN 3: FOH MASTER CONSOLE & REMOTE KICK
  [PASS] [04] DOMAIN 4: 4-DOMAIN TELEMETRY & PORT HYGIENE
  [PASS] [05] DOMAIN 5: ENGINE REMEDIATION & INVARIANTS
  [PASS] [06] DOMAIN 6: MULTI-PLAYER SCENARIOS & PROFILES
  [PASS] [07] DOMAIN 7: HEADLESS PLAYWRIGHT BROWSER UI
  [PASS] [08] DOMAIN 8: HYBRID MULTI-SCENE & PARTICLE CANVAS
  [PASS] [09] DOMAIN 9: SELF-HEALING ARCHITECTURE & MASTER PIN
--------------------------------------------------------------------
TOTAL RESULT: 9/9 DOMAINS PASSED (100% DETERMINISTIC PASS)
====================================================================
```
