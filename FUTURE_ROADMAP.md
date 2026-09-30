# TDBridge Long-Term System Roadmap & Architectural Milestones

This document serves as the authoritative architectural record of completed milestones, live production capabilities, and scheduled future expansions for the **TDBridge** multi-user TouchDesigner performance platform.

---

## Milestone 1: Swiss Graphic Monolith Design System & Onboarding Ergonomics (COMPLETED & LIVE)
- [x] **Swiss Graphic Monolith UI**: High-contrast brutalist gallery styling (`#000000` / `#ffffff`, 2px stark framing, zero fake AI badges/gradients, pure Space Grotesk display typography and JetBrains Mono telemetry).
- [x] **Omni-Device Layout**: Optimized viewports for mobile phones (portrait single-thumb ergonomically mapped touch zones), tablets / iPads (dual-column split workstation), and desktop workstations (WASD / 1-4 hotkey mapping).
- [x] **Frictionless Onboarding Gate (`#gate`)**:
  - Auto-room-code detection from URL parameter (`?room=LG7U`) and fallback pre-fill via `/room` REST endpoint.
  - 4-box segmented room code display with automatic character advancement, backspace retreat, and clipboard paste handling.
  - High-precision handle generator and 8-color neon stage palette selector (Cyan, Magenta, Lime, Amber, Purple, Crimson, Teal, White) synchronized with TouchDesigner performer hues.
- [x] **Real Network Telemetry (No Fakes)**:
  - Client-side WebSocket ping/pong round-trip latency loop (`performance.now()`).
  - Real-time link health pills (`RTT: 14ms // SYNC`, `RTT: 68ms // WI-FI`, `RTT: TIMEOUT // LOSS`).
- [x] **Vector Reticle & 60Hz Oscilloscope**:
  - Continuous analog joystick with circular clamp bounds, return-to-center spring physics, and `<canvas id="vector-canvas">` 60Hz phosphor oscilloscope trace with velocity decay trails.

---

## Milestone 2: Role-Based Access Control (RBAC) & TouchDesigner Schema Alignment (COMPLETED & LIVE)
- [x] **3-Tier Role Hierarchy**:
  - **Tier 1: Master Operator Console (`02 // MASTER CONSOLE`)**:
    - Front-of-House (FOH) broadcast dashboard for show directors.
    - Global scene switcher (`AQUARIUM`, `CANVAS`, `KINETIC` / `QR`) broadcasting `/bridge/scene` OSC to TouchDesigner's `switch_preview`.
    - Emergency stage cues: `RESET ENGINE` (`/bridge/reset`) and `PURGE SLOTS`.
    - Live Performer Roster table with live slot numbers, handle names, color indicators, real RTT readouts, and individual remote kick actions.
  - **Tier 2: Performer Controller Surface (`01 // PERFORMER`)**:
    - Dedicated allocation to TouchDesigner human slots (slots 6–100).
    - 4 action trigger buttons strictly mapped to TouchDesigner logic:
      - `b1`: Rotate 360°
      - `b2`: Color Swap (cycles stage palette)
      - `b3`: Feed Fish (spawns real-time physics food pellets via `food_manager`)
      - `b4`: Special / Scare (triggers environment reaction)
    - Precision dual sliders:
      - `s1`: Swim Speed (0.0 .. 1.0)
      - `s2`: Scale / Size (0.35 .. 0.95)
  - **Tier 3: Audience Spectator Hype Surface (`03 // AUDIENCE`)**:
    - Zero slot consumption (unlimited audience members connect simultaneously without filling player slots 6–100).
    - High-energy interactive BPM Tap Tempo synchronizer (calculates moving-average BPM from crowd taps).
    - 4-channel crowd reaction matrix (`fire`, `bolt`, `heart`, `party`) emitting instant audience bursts to TouchDesigner.
- [x] **Extensible Swiss Component Catalog**:
  - Industrial 270° rotary stepper dial (`.mono-dial`) with SVG arc tracking and numeric readout.
  - 12-segment vertical VU peak meter (`.mono-vu-fader`) with dB scale tick marks and gradient illumination.
  - 3-way segmented state toggles (`.mono-toggle`) with tactile binary inversion.
- [x] **TouchDesigner Engine Invariant Fix**:
  - Verified and locked `out_players_chop` to **13 channels x 100 samples** by configuring `lag_smoothing.par.timeslice = False`.
  - Maintained `players_data` table at fixed 101 rows (row 0 header + rows 1–100).
  - Maintained passive FIFO `bridge_osc_in` with `callbacks = ''` drained per frame by `osc_processor`.

---

## Milestone 3: Zero-Code TouchDesigner Designer Interface & Dynamic Blueprints (UPCOMING)
- [ ] **`ui_blueprint` TableDAT in `TDBridge`**:
  - Native TouchDesigner table where visual artists configure UI controls (`id`, `type`, `label`, `color`, `min`, `max`, `step`) without editing web or TypeScript code.
- [ ] **`Push Blueprint` Pulse Parameter**:
  - Single pulse button on `TDBridge` COMP that serializes `ui_blueprint` to compact JSON and sends `/bridge/set_blueprint` to UDP port 9001, instantly hot-reloading all mobile screens live.
- [ ] **WebRTC Low-Latency Video Return**:
  - Stream TouchDesigner's `final_out` directly back to connected mobile phones via WebRTC (or H.264 ultra-low-latency stream) so performers view their visual impact on their phone screen with <50ms glass-to-glass delay.

---

## Milestone 4: Show Automation & Multi-Venue Enterprise Ecosystem (FUTURE)
- [ ] **Master Show Sequencer**:
  - Automatic performance transitions:
    - *Lobby Phase:* Fullscreen QR code + ambient autonomous bots on projector.
    - *Play Phase:* Audience joins, controls interactive visuals.
    - *Climax Phase:* Auto-morph profile to Audience Beat Pulser + trigger generative audio-reactive shaders.
- [ ] **Multi-Room Federation**:
  - Dynamic QR code venue routing: one entrance QR routes attendees to sub-rooms (Room A = Fishtank, Room B = Particle Ribbons, Room C = Laser Synth) based on load balancing.
- [ ] **External Show Control Bridges**:
  - Native Ableton Link tempo sync, Resolume Arena OSC routing, and DMX / Art-Net lighting cue integration.
