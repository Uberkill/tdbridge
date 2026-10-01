# TDBridge: High-Concurrency Mobile & Show Control System for TouchDesigner

Zero-install, broadcast-grade mobile controller and front-of-house (FOH) show control pipeline for Derivative TouchDesigner. Turns audience smartphones into low-latency interactive performance controllers over WebSockets, routed via high-frequency local OSC/UDP with 100% cook-loop immunity.

---

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    NETWORK INGRESS                                     │
│                                                                                        │
│   Mobile Phones (Up to 100 Performers / Unlimited Spectators)                          │
│        │                                                                               │
│        ├── [ 01 // PERFORMER ] ─── (WebSocket: 60Hz Joysticks, Triggers, Faders)       │
│        ├── [ 02 // SPECTATOR ] ─── (WebSocket: Real-Time BPM Tap & Reaction Matrix)   │
│        └── [ // FOH OPERATOR ] ─── (WebSocket: Secure Master Key / 4-Digit PIN)       │
│                                                                                        │
│                     │                                                                  │
│                     ▼  Port 8080 (Local LAN / Cloudflare Tunnel)                       │
│   ┌──────────────────────────────────────────────────────────────────┐                 │
│   │               Node.js Relay Supervisor (relay.ts)                │                 │
│   │  • Deferred Slot Reservation (Slots 6–100 humans, 1–5 bots)     │                 │
│   │  • Dual-Code Security (Public Room Code vs Private Master Key)   │                 │
│   │  • Rate-Limiting & Anti-Flooding (60Hz clamp, Brute-Force Defense)│                │
│   │  • Live Performer Roster & Remote Kick Engine                    │                 │
│   │  • Scene & Dynamic Blueprint Registry                            │                 │
│   └──────────────────────────────────────────────────────────────────┘                 │
│              │                                        ▲                                │
│   OSC / UDP  │ Port 9000                   OSC / UDP  │ Port 9001                      │
│   (/slot_*,  │ (/env/*,                    (/td/fps,  │ (/td/scene_list,               │
│    /bridge/*)│  /bridge/scene)              /td/error)│  /td/scene_health)             │
│              ▼                                        │                                │
│   ┌──────────────────────────────────────────────────────────────────┐                 │
│   │               TouchDesigner Engine (TDBridge.toe)                │                 │
│   │  • Passive FIFO oscinDAT (bridge_osc_in with callbacks='')       │                 │
│   │  • Atomic Frame Drain via osc_processor (Execute DAT)            │                 │
│   │  • Invariant Contracts: players_data (101x15) & out_players_chop │                 │
│   │  • Self-Healing Scene Engine & 1-Click Template Scaffolding      │                 │
│   │  • switch_preview Video Switcher & Multi-Scene Routing           │                 │
│   └──────────────────────────────────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

- **Dual-Code Security Architecture:**
  - **Public Room Code (4 chars, e.g. `HJHX`):** Displayed on screen/QR for attendee entry. Performers and spectators cannot trigger master cues or kick players.
  - **Private Master Key (`OP-XXXXXX`) or 4-Digit PIN (`1234`):** Displayed strictly in the operator terminal and TouchDesigner custom parameters. Grants access to the FOH Master Operator Console.
- **Dedicated FOH Master Operator Console (`#master-ui`):**
  - Full-bleed 3-column workstation layout scaling across 1080p, 1440p, and 4K displays.
  - Live scrollable performer roster table with individual disconnect/kick triggers.
  - Global show scene switcher with zero-reconnect live transitions.
  - Scene-adaptive environment parameters rack (Aquarium bot controls, Canvas trail persistence, and dynamic custom parameters).
  - 4-domain observability HUD (cook FPS, loopback latency, client RTT, error ring buffer).
- **Hybrid Multi-Scene & Self-Healing Network Engine:**
  - **1-Click Auto-Link (`[Audit & Self-Heal Network]`):** Scans `/project1` for scene COMPs, auto-drops `select_bridge` (`selectCHOP`) for player data, auto-wires `out1` (`outTOP`) to `switch_preview`, and heals broken references without blackouts.
  - **1-Click Scene Scaffolder (`[Create Scene Template]`):** Instantly creates a clean, pre-wired generative Base COMP ready for custom visuals.
- **Dynamic Blueprint Engine (Performer Surface):**
  - Purged hardcoded HTML labels. Controls morph dynamically to match the active scene (`gamepad` for Aquarium, `touchpad` for Canvas, `faderbank` for DJ mixer, `audience` for Hype).
  - In-memory DOM pool reuses element IDs (`#btn-b1`–`#btn-b4`, `#slider-s1`–`#slider-s4`) ensuring 100% test and OSC stability.
- **Swiss Graphic Monolith Design System:**
  - High-contrast pure black (`#000000`) and stark white framing (`#ffffff`).
  - Space Grotesk display typography and JetBrains Mono telemetry.
  - Zero emojis (purged in favor of monospaced ASCII badges `[01 // IGN]`, `[02 // STRB]`).
  - 60Hz vector oscilloscope reticle with phosphorescent velocity decay trail.
  - Desktop keyboard controls (WASD joystick, 1–4 triggers, Space strobe).

---

## 3. Quick Start

### Step 1: Launch System
Double-click **`Start_System.bat`** (or run `npm start` in terminal).  
The launcher automatically verifies Node.js, clears stale network ports, compiles TypeScript, initializes Cloudflare tunnel (if online), and outputs the terminal dashboard:

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
- **Attendees:** Scan the on-screen QR code (or visit `http://127.0.0.1:8080?room=HJHX`). Choose **[01 // PERFORMER]** or **[02 // SPECTATOR]**.
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
   - Displays the room code and QR code for crowd onboarding.
4. **`switch_preview` (Video Switcher TOP):**
   - Seamlessly switches video between active scenes (`1_Fishtank`, `2_particle_canvas`, `out_qr_top`, or custom scenes).

---

## 5. Controller Profiles & Blueprints

| Profile | Target Archetype | Primary Controls | OSC Channels |
| :--- | :--- | :--- | :--- |
| **`gamepad`** | Interactive Avatars (Aquarium) | Vector Joystick, 4 Triggers, 2 Sliders | `tx, ty, b1..b4, s1..s2` |
| **`touchpad`** | Generative Drawing (Particle Canvas) | 2D Canvas Surface, 3 Triggers, Brush Slider | `tx, ty, b1..b3, s1` |
| **`faderbank`** | Audio/Visual Mixing | 4 Vertical Mixers, 4 Flash Triggers | `s1..s4, b1..b4` |
| **`audience`** | Crowd Participation / Spectator | BPM Tap Pulser, 4 Reaction Burst Pads | `tap_rate, b1..b4` |
| **`custom`** | Artist Defined | Dynamic Table DAT (`ui_blueprint`) | Dynamic binding |

---

## 6. Verification & Automated Test Suite

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
