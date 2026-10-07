# TDBridge Development Roadmap

Record of completed capabilities and upcoming features for TDBridge.

---

## Completed Milestones

### Milestone 1: Core Controller & Onboarding UI
- [x] **Brutalist Dark UI**: High-contrast dark styling (`#000000` / `#ffffff`, 2px industrial borders, Space Grotesk display typography and JetBrains Mono telemetry).
- [x] **Single-Action Attendee Onboarding**:
  - Direct performer entry via `[ENTER STAGE]`.
  - Automatic room code extraction from URL parameter (`?room=XXXX`).
  - 4-box segmented room code input with auto-advance and backspace handling.
  - Callsign handle generator with randomizer `[ ⟳ RND ]` and 8-color stage palette ribbon.
- [x] **Real-Time Latency Tracking**:
  - Client-side WebSocket ping/pong loop (`performance.now()`).
  - Real-time link health tags (`RTT: 14ms // LINKED`).
- [x] **Vector Joystick & Oscilloscope**:
  - Continuous analog joystick with circular clamp bounds, return-to-center spring physics, and `<canvas>` 60Hz phosphor oscilloscope trace with velocity decay trails.

### Milestone 2: Multi-Scene Control & Dynamic Blueprints
- [x] **FOH Master Operator Console (`#master-ui`)**:
  - 3-column workstation layout scaling across 1080p, 1440p, and 4K displays.
  - Global show scene switcher (`AQUARIUM`, `CANVAS`, `QR`) broadcasting `/bridge/scene` OSC to TouchDesigner's `switch_preview`.
  - Scene-adaptive environment controls rack (Aquarium bot parameters, Canvas feedback persistence, and dynamic sliders).
  - Live performer roster with slot numbers, handles, color swatches, RTT values, and individual remote kick triggers.
  - Emergency cues: `RESET ENGINE` (`/bridge/reset`) and `PURGE SLOTS`.
- [x] **Dynamic Blueprint Engine**:
  - Controls morph dynamically to match the active scene (`gamepad` for Aquarium, `touchpad` for Canvas, `faderbank` for DJ mixer, `audience` for Hype).
  - In-memory DOM pool reuses element IDs (`#btn-b1`–`#btn-b4`, `#slider-s1`–`#slider-s4`) ensuring test stability.
- [x] **TouchDesigner Engine Contracts**:
  - Locked `out_players_chop` to 13 channels x 100 samples.
  - Fixed `players_data` table at 101 rows (row 0 header + rows 1–100).
  - Decoupled passive FIFO `bridge_osc_in` drained per frame by `osc_processor`.

### Milestone 3: Self-Healing Architecture & Universal Scaling
- [x] **Self-Healing Scene Engine (`scene_manager.py`)**:
  - `[Audit & Self-Heal Network]`: Automatically scans `/project1` for scene COMPs, attaches `select_bridge` (`selectCHOP`) for player data, and wires video `out1` (`outTOP`) to `switch_preview`.
  - `[Create Scene Template]`: Scaffolds a new generative Base COMP in 1 click.
  - Failover blackout protection: Falls back safely to `out_qr_top` if an active scene is deleted or errors.
- [x] **Dynamic Session Branding from TouchDesigner**:
  - `Sessionname` custom parameter on `TDBridge` emits `/td/session_name` via OSC.
  - Synchronizes web client title (`#brand-title`) and stage QR display (`out_qr_top`) live without server restarts.
- [x] **Multi-Device Responsive Scaling**:
  - Fluid tokens across 5 breakpoints (`<768px`, `768px`, `1024px`, `1920px`, `2560px+`).
  - 4K monitors render a wide monolith card; mobile screens preserve touch targets >= 44px.
  - Centering and scroll protection eliminating header clipping on landscape phones.
- [x] **Covert FOH Access**:
  - Subtle `OP-ACCESS` micro-trigger at bottom-right (`opacity: 0.15`), `Ctrl+Shift+O`, `~` shortcut, or `?key=1234` URL param.
- [x] **Telemetry Stability & Heartbeat Guards**:
  - Value-change guards in `relay.ts` on `/bridge/master_pin`, `/td/scene_list`, and `/td/scene_health` eliminate terminal spam.

---

## Upcoming Milestones

### Milestone 4: WebRTC Video Return
- [ ] **Low-Latency Video Return Stream**:
  - Stream TouchDesigner's `switch_preview` directly back to connected mobile phones via WebRTC (sub-100ms glass-to-glass delay) so performers view their visual impact on their phone screen.
- [ ] **Stage Camera PiP**:
  - Picture-in-picture window on performer phones showing the live stage or crowd reaction.

### Milestone 5: Venue Federation & Automation
- [ ] **Multi-Room Routing**:
  - Single entrance QR code routing attendees to sub-rooms (Room A = Fishtank, Room B = Particle Ribbons, Room C = Laser Synth) based on room capacity.
- [ ] **Master Show Sequencer**:
  - Automated performance transitions across Lobby, Interactive, and Climax phases.
- [ ] **External Show Bridges**:
  - Ableton Link tempo sync, Resolume Arena OSC routing, and DMX / Art-Net lighting cue integration.
