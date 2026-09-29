# TDBridge

Zero-install mobile controller pipeline for TouchDesigner. Connects mobile browsers over WebSockets and relays input to TouchDesigner via local OSC/UDP.

---

## Architecture Overview

```text
Phone Browser ──(WebSocket / HTTPS)──► Node.js Relay (Port 8080)
                                            │
                                            ├── OSC UDP (Port 9000) ──► TouchDesigner
                                            │                            • TDBridge.tox / testing_final.toe
                                            │
TouchDesigner ── OSC UDP (Port 9001) ───────┘
  • Telemetry (/td/fps, /td/clones)
  • Profile hot-swaps (/bridge/profile)
```

- **Node.js Relay** (`src/server/relay.ts`): Manages player slots (1–100), throttles input to 60Hz per slot, tracks session timeouts, runs live terminal telemetry, and drives the optional Cloudflare tunnel.
- **TouchDesigner Engine**: Ingests OSC data without callback-induced cook dependency loops, updating downstream CHOPs and DATs every frame.

---

## Quick Start

### 1. Requirements
- Windows 10/11
- Node.js 18+
- TouchDesigner 2023+ / 2025+

### 2. Start the Relay
Double-click **`Start_System.bat`** (or run `npm start` in terminal).
The launcher will:
1. Verify Node.js dependencies.
2. Compile TypeScript (`src/` → `dist/`).
3. Launch `cloudflared.exe` from `bin/` (if internet is available).
4. Print the active Room Code, local LAN URL, public tunnel URL, and ASCII QR code.

### 3. Open TouchDesigner
Open **`testing_final.toe`** (or **`TDBridge.toe`**).
The network connects to the relay over local ports 9000/9001 automatically.

---

## Directory Structure

```text
TDBridge/
├── testing_final.toe         # Main TouchDesigner project (Aquarium Showcase)
├── TDBridge.toe              # Direct mirror of testing_final.toe
├── TDBridge.tox              # Standalone core component (MediaPipe-style drop-in)
├── Start_System.bat          # Production launcher
├── package.json              # Dependencies and build/test scripts
│
├── bin/                      # Third-party binaries (cloudflared.exe)
├── core/                     # Reusable TDBridge.tox package and documentation
├── examples/
│   ├── 01_Aquarium/          # Full interactive aquarium demo (Aquarium_Demo.toe)
│   └── 02_Particle_Canvas/   # GPU-instanced 3D particle template (Particle_Canvas.tox)
│
├── src/                      # TypeScript sources
│   ├── server/               # relay.ts, profiles.ts
│   └── client/               # app.ts (mobile UI rendering)
├── dist/                     # Compiled JavaScript (relay.js, profiles.js)
├── public/                   # Frontend assets (index.html, app.js, style.css)
│
├── tests/                    # Test suite
│   ├── unit/                 # Unit tests (Jest)
│   ├── e2e/                  # Automated integration tests
│   └── run_all_tests.js      # Full suite runner (`npm test`)
│
├── tools/                    # Operational diagnostics (latency, frame capture)
├── Backup/                   # Backups & immutable pre-MediaPipe master save
└── archive/                  # Retired prototype scripts and historical logs
```

---

## Controller Profiles

The web frontend supports hot-reloading controller profiles on the fly without disconnecting users or losing assigned player slots:

| Profile | Primary Controls | TouchDesigner Output |
| :--- | :--- | :--- |
| **`gamepad`** | Floating analog joystick, 4 action buttons, 2 sliders | `tx, ty, b1..b4, s1..s2` |
| **`touchpad`** | Normalized 2D canvas (`[-1, 1]`), 3 action buttons, brush slider | `tx, ty, b1..b3, s1` |
| **`faderbank`** | 4 vertical mixer faders, 4 momentary flash pads | `s1..s4, b1..b4` |
| **`audience`** | Large tap button (calculates live BPM), 4 emoji reactions | `tap_rate, b1..b4` |
| **`custom`** | Blueprint-defined controls delivered via JSON | Dynamic binding |

To change the active profile across all connected phones:
- In TouchDesigner: Change the **`Profile`** parameter on `TDBridge.tox`.
- Via HTTP: `POST http://127.0.0.1:8080/profile/<name>`

---

## TouchDesigner Contract Outputs (`TDBridge.tox`)

When `TDBridge.tox` is dropped into any project, it exposes four standard output operators:

1. **`out_players_chop`**: Fixed 13-channel numeric stream across 100 sample slots:
   - Channels: `active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `s3`, `s4`, `tap_rate`, `rot`.
   - Inactive player slots output `0.0`.
2. **`out_players_dat`**: 15-column TableDAT listing slot ID, connection status, display name, and all current channel values.
3. **`out_qr_top`**: 256x256 TOP displaying the session QR code and room code.
4. **`events_callbacks`**: Python callbacks for integration:
   - `onPlayerJoin(slot, name)`
   - `onPlayerLeave(slot)`
   - `onButton(slot, button_id, state)`
   - `onCustomEvent(slot, event_name, value)`

---

## Verification & Testing

Run the automated integration test suite:

```bash
npm test
```

Measure round-trip network latency:

```bash
npm run latency
```
