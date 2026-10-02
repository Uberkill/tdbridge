# TDBridge Long-Term System Roadmap & Architectural Milestones

This document serves as the authoritative architectural record of completed milestones, live production capabilities, and scheduled future expansions for the **TDBridge** multi-user TouchDesigner performance platform.

---

## Milestone 1: Swiss Graphic Monolith Design System & Onboarding Ergonomics (COMPLETED & LIVE)
- [x] **Swiss Graphic Monolith UI**: High-contrast brutalist gallery styling (`#000000` / `#ffffff`, 2px stark framing, zero fake AI badges/gradients, pure Space Grotesk display typography and JetBrains Mono telemetry).
- [x] **Single-Action Performer Onboarding**:
  - Eliminated role confusion: every attendee enters directly as an interactive performer via `[ ENTER STAGE -> ]`.
  - Auto-room-code detection from URL parameter (`?room=LG7U`).
  - 4-box segmented room code display with automatic character advancement and backspace retreat.
  - Callsign handle generator with integrated muted randomizer `[ ⟳ RND ]` and 8-color stage palette ribbon.
- [x] **Real Network Telemetry (No Fakes)**:
  - Client-side WebSocket ping/pong round-trip latency loop (`performance.now()`).
  - Real-time link health pills (`RTT: 14ms // SYNC`, `RTT: 68ms // WI-FI`, `RTT: TIMEOUT // LOSS`).
- [x] **Vector Reticle & 60Hz Oscilloscope**:
  - Continuous analog joystick with circular clamp bounds, return-to-center spring physics, and `<canvas id="vector-canvas">` 60Hz phosphor oscilloscope trace with velocity decay trails.

---

## Milestone 2: Hybrid Multi-Scene Show Control & Dynamic Blueprint Engine (COMPLETED & LIVE)
- [x] **Dedicated FOH Master Operator Console (`#master-ui`)**:
  - Full-bleed 3-column workstation layout scaling across 1080p, 1440p, and 4K displays.
  - Global show scene switcher (`AQUARIUM`, `CANVAS`, `QR`) broadcasting `/bridge/scene` OSC to TouchDesigner's `switch_preview`.
  - Scene-adaptive environment controls rack (Aquarium bot controls, Canvas trail persistence, and dynamic custom parameters).
  - Live Performer Roster table with live slot numbers, handle names, color indicators, real RTT readouts, and individual remote kick actions.
  - Emergency stage cues: `RESET ENGINE` (`/bridge/reset`) and `PURGE SLOTS`.
- [x] **Dynamic Blueprint Engine (Performer Surface)**:
  - Purged hardcoded HTML labels. Controls morph dynamically to match the active scene (`gamepad` for Aquarium, `touchpad` for Canvas, `faderbank` for DJ mixer, `audience` for Hype).
  - In-memory DOM pool reuses element IDs (`#btn-b1`–`#btn-b4`, `#slider-s1`–`#slider-s4`) ensuring 100% test and OSC stability.
- [x] **TouchDesigner Engine Invariant Contracts**:
  - Verified and locked `out_players_chop` to **13 channels x 100 samples**.
  - Maintained `players_data` table at fixed 101 rows (row 0 header + rows 1–100).
  - Maintained passive FIFO `bridge_osc_in` with `callbacks = ''` drained per frame by `osc_processor`.

---

## Milestone 3: Self-Healing Network, Dynamic Branding & Universal 4K Scaling (COMPLETED & LIVE)
- [x] **1-Click Self-Healing Scene Engine (`scene_manager.py`)**:
  - `[Audit & Self-Heal Network]`: Automatically scans `/project1` for scene COMPs, attaches `select_bridge` (`selectCHOP`) for player data, and wires video `out1` (`outTOP`) to `switch_preview`.
  - `[Create Scene Template]`: Instantly scaffolds a new generative Base COMP in 1 click.
  - Failover blackout protection: Falls back safely to `out_qr_top` if an active scene is deleted or errors.
- [x] **Dynamic Session Branding from TouchDesigner**:
  - `Sessionname` custom parameter on `TDBridge` emits `/td/session_name` via OSC.
  - Synchronizes the web client title (`#brand-title`) and the stage QR display (`out_qr_top`) live without server restarts.
- [x] **Universal 4K UHD & Multi-Device Fluid Tokens**:
  - Fluid token architecture across 5 breakpoints (`<768px`, `768px`, `1024px`, `1920px`, `2560px+`).
  - 4K monitors render an expansive 1075px monolith card; mobile screens preserve touch targets $\ge 44\text{px}$.
  - Centering and scroll protection eliminating header clipping on landscape phones.
- [x] **Covert Front-of-House (FOH) Access**:
  - Subtle `OP-ACCESS` micro-trigger at bottom-right (`opacity: 0.15`), `Ctrl+Shift+O`, `~` shortcut, or `?key=1234` URL param.
- [x] **Telemetry Stability & Heartbeat Guards**:
  - Value-change guards in `relay.ts` on `/bridge/master_pin`, `/td/scene_list`, and `/td/scene_health` eliminate terminal spam and ring buffer eviction.
- [x] **Codebase Knowledge Graph (Graphify)**:
  - Persistent knowledge graph indexing 84 communities, D3 interactive map (`graph.html`), and query CLI.

---

## Milestone 4: WebRTC Ultra-Low-Latency Video Return (UPCOMING)
- [ ] **WebRTC Video Return Stream**:
  - Stream TouchDesigner's `switch_preview` directly back to connected mobile phones via WebRTC (or ultra-low-latency H.264) so performers view their visual impact on their phone screen with <50ms glass-to-glass delay.
- [ ] **Selective Stage Camera PiP**:
  - Optional picture-in-picture window on performer phones showing the live stage or crowd reaction.

---

## Milestone 5: Multi-Room Venue Federation & Show Automation (FUTURE)
- [ ] **Multi-Room Venue Federation**:
  - Dynamic QR code venue routing: one entrance QR routes attendees to sub-rooms (Room A = Fishtank, Room B = Particle Ribbons, Room C = Laser Synth) based on capacity and load balancing.
- [ ] **Master Show Sequencer**:
  - Automatic performance transitions:
    - *Lobby Phase:* Fullscreen QR code + ambient autonomous bots on projector.
    - *Play Phase:* Audience joins, controls interactive visuals.
    - *Climax Phase:* Auto-morph profile to High-Entropy Particle Storm + trigger generative audio-reactive shaders.
- [ ] **External Show Control Bridges**:
  - Native Ableton Link tempo sync, Resolume Arena OSC routing, and DMX / Art-Net lighting cue integration.
