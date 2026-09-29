# TDBridge Core Component (`TDBridge.tox`)

`TDBridge.tox` is the standalone, universal input component that turns mobile smartphones into zero-install low-latency interactive controllers for TouchDesigner, modeled after the modular architecture of Google MediaPipe.

## Quick Start (Drag & Drop)
1. Drag `TDBridge.tox` into your TouchDesigner network.
2. Launch the relay server (`node dist/relay.js` or double-click `Start_System.bat`).
3. Scan the QR code displayed on `out_qr_top` with any mobile phone.
4. Wire your visual system to:
   - `out_players_chop`: 13 numeric channels across 100 slots (`active, tx, ty, b1..b4, s1..s4, tap_rate, rot`).
   - `out_players_dat`: Entity table with slot IDs, user names, active status, and custom properties.
   - `events_callbacks`: Standard Python callbacks (`onPlayerJoin`, `onPlayerLeave`, `onButton`, `onCustomEvent`).

## Component Parameters
- **Profile**: Dropdown selector (`gamepad`, `touchpad`, `faderbank`, `audience`, `custom`). Dynamically hot-swaps all connected phone UIs without disconnecting or dropping player slots.
- **Roomcode**: Read-only display of the current active room code.
- **Status**: Live heartbeat and framerate telemetry.
- **Maxplayers**: Configured user limit (default 100).
- **Portin / Portout**: OSC ports (9000 In / 9001 Out).
