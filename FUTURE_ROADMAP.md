# TDBridge Long-Term System Roadmap

This document persists future architectural milestones, advanced features, and TouchDesigner integrations deferred from the initial UI and onboarding overhaul.

---

## Milestone 1: Visual Design & Onboarding Ergonomics (ACTIVE)
- Three professional visual design systems (Precision Hardware, Pro Studio Dark, Swiss Monolith).
- Next-generation onboarding gate: frictionless auto-room-code detection, clean name entry, 8-color neon hue picker.
- High-precision tactile gamepad & input loop with client-side 60Hz rate limiting, multi-touch isolation, and safe-area geometry.

---

## Milestone 2: Modular Controller Archetypes & Profile Expansion
- **Universal Pro Gamepad**: Decoupled from application-specific labels; universal analog joystick with return-to-center physics + 4 action triggers + 2 macro sliders.
- **XY Kaoss Surface**: Continuous 2D touch tracking with live coordinate crosshairs (`[-1, 1]`) and 4 momentary flash triggers.
- **VJ Fader Mixer**: 4 vertical multi-touch channels with glowing level fills, percentage readouts, and solo/flash pads.
- **Clip Launchpad Matrix**: 4x2 / 3x3 backlit cue matrix for scenes, one-shots, and strobe bursts.
- **Audience Hype & Beat Pulser**: Live BPM tap calculation with ripple feedback, reaction blasts, and optional iOS/Android motion sensor tilt (`devicemotion` / `deviceorientation` with explicit user permission).

---

## Milestone 3: Zero-Code TouchDesigner Designer Interface
- **`ui_blueprint` TableDAT**: A native TouchDesigner table where visual artists can configure control elements (`id`, `type`, `label`, `color`, `min`, `max`, `step`) without editing web or TypeScript code.
- **`Push Blueprint` Parameter**: A single pulse parameter on the `TDBridge` COMP that serializes the table to compact JSON and transmits `/bridge/set_blueprint` to UDP port `9001`, instantly re-skinning all connected mobile devices in real time.
- **Channel Invariant Guarantee**: Full backward-compatibility with `out_players_chop` (13 union channels x 100 samples) and `players_data` (101 fixed rows).

---

## Milestone 4: Show Runner & Multi-System Show Automation
- **Master Show Cue COMP**: Orchestrates performance phases:
  - *Phase 1 (Lobby / Intro):* Fullscreen QR display + ambient bot movement while audience joins.
  - *Phase 2 (Play):* Interactive visual mode with Gamepad / Touchpad profile.
  - *Phase 3 (Music Peak):* Auto-switch profile to Audience Beat Pulser + switch visuals to high-energy instancing.
- **Modular Project Integration**:
  - `Digital_Tree_2.tox`: Direct hookup to audience tap rates and joystick vectors.
  - `audio_fabric.tox`: Binding kick detection and 32-beat phrase sync to audience control states.
  - `video_recorder.tox`: Auto-recording clean 1080p/4K master outputs from `final_out`.
