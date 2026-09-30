# TDBridge Developer Onboarding Guide

Practical reference for developers and agents working on the TDBridge codebase.

---

## 1. Quick Verification Run

Before modifying code, confirm that the local environment is healthy:

1. **Start the Relay**:
   ```bash
   Start_System.bat
   ```
   *(Or run `npm start` in your shell).*
2. **Open the TouchDesigner Project**:
   Open [`TDBridge.toe`](TDBridge.toe) in TouchDesigner. Confirm the status parameter displays `Online - 60.0 FPS`.
3. **Execute the Verification Suite**:
   Open a separate terminal and run:
   ```bash
   npm test
   ```
   All 5 integration tests (profile switching, live CHOP streaming, aquarium feeding, single-player movement, and multi-player concurrency) must pass with exit code `0`.

---

## 2. Invariant Rules — Read Before Editing TouchDesigner

### Rule 1: Never Attach Callbacks to `bridge_osc_in`
`bridge_osc_in` is an `oscinDAT` configured as a passive FIFO buffer (`callbacks = ''`). Writing to any table DAT from an OSC callback registers that table as a cook dependency, triggering an infinite cook loop that disables the network port.
- **Correct approach**: Message parsing happens inside `osc_processor` (an `ExecuteDAT`) triggered strictly on `onFrameStart`.

### Rule 2: Keep the 101-Row Fixed Schema
Do not delete or append rows to `players_data` or `user_data` during live sessions. Row `N` directly corresponds to `Slot N`. Dynamic row resizing causes Replicator COMP stalls and crashes downstream CHOP converters.

### Rule 3: Maintain the 13 Union Channels on `out_players_chop`
Downstream render engines and geometry instancers rely on static channel indices. Always maintain the standard 13 channels:
`active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `s3`, `s4`, `tap_rate`, `rot`.
If a controller profile does not use a specific channel (e.g. `s3` in Gamepad mode), output `0.0`.

### Rule 4: Slots 1–5 Are Reserved
- Slots `1` to `5` are reserved for autonomous demo agents / background choir fish.
- Real human connections start at Slot `6` and extend to Slot `100`.

---

## 3. Key File Locations

- **Relay Server**: [`src/server/relay.ts`](src/server/relay.ts) (WebSocket & OSC router).
- **Controller Profiles**: [`src/server/profiles.ts`](src/server/profiles.ts) (Archetype blueprints).
- **Client Frontend**: [`src/client/app.ts`](src/client/app.ts) and [`public/app.js`](public/app.js).
- **Standalone Core Component**: [`TDBridge.tox`](TDBridge.tox) and [`core/TDBridge.tox`](core/TDBridge.tox).
- **Aquarium Showcase**: [`TDBridge.toe`](TDBridge.toe) (and archived [`Backup/legacy_testing_final/testing_final.toe`](Backup/legacy_testing_final/testing_final.toe) / [`examples/01_Aquarium/Aquarium_Demo.toe`](examples/01_Aquarium/Aquarium_Demo.toe)).
- **Pre-MediaPipe Fallback Backup**: [`Backup/MASTER_PRE_MEDIAPIPE_AQUARIUM_SAVE/`](Backup/MASTER_PRE_MEDIAPIPE_AQUARIUM_SAVE/).

---

## 4. Typical Tasks

### Adding a New Control to a Profile
1. Open [`src/server/profiles.ts`](src/server/profiles.ts) and add the control definition to the profile's `blueprint` array.
2. In [`src/client/app.ts`](src/client/app.ts), verify that the mounting function for that profile renders the element and binds touch/mouse events to `sendControl(id, value)`.
3. In `osc_processor` in TouchDesigner, map the incoming `/slot_<N>_<id>` to the desired table cell or custom parameter.
4. Run `npm test` to verify zero regressions.

### Changing the Active Controller Profile
- In TouchDesigner: Set the `Profile` parameter on `TDBridge` (`gamepad`, `touchpad`, `faderbank`, `audience`).
- Via REST: Send `POST http://127.0.0.1:8080/profile/<profile_name>`.
- Via OSC: Send `/bridge/profile <profile_name>` to UDP port `9001`.
