# TDBridge Technical Architecture

Specification of network protocols, TouchDesigner execution patterns, data schemas, and reliability guarantees.

---

## 1. Network Topology & Ports

```text
Phone Browser ──(WebSocket, Port 8080)──► Node.js Relay ──(OSC/UDP, Port 9000)──► TouchDesigner
                                                │                                       │
                                                ◄──────(OSC/UDP, Port 9001)─────────────┘
```

| Route | Protocol | Default Port | Purpose |
| :--- | :--- | :--- | :--- |
| **Client → Relay** | WebSocket (`ws://` / `wss://`) | `8080` | JSON input packets (`join`, `input`, `control`, `tap`, `env`). |
| **Relay → TouchDesigner** | OSC over UDP | `9000` | Real-time channel and control updates (`/slot_<N>_<chan>`). |
| **TouchDesigner → Relay** | OSC over UDP | `9001` | Frame rate telemetry (`/td/fps`), clone counts (`/td/clones`), profile requests (`/bridge/profile`). |
| **Public Ingress** | HTTPS / WSS | `443` | Optional Cloudflare tunnel (`bin/cloudflared.exe`) mapping to local port 8080. |

---

## 2. TouchDesigner Ingestion & Cook-Loop Prevention

A common failure mode in TouchDesigner OSC architectures occurs when an `oscinDAT` modifies a table referenced in downstream scripts, triggering an infinite cook dependency loop:

```text
oscinDAT (callback) ──writes to──► TableDAT ──dirty event──► oscinDAT cooks again (LOOP)
```

### Mitigation Architecture
1. **Passive Buffer**: `bridge_osc_in` runs with `par.callbacks = ''` and `par.splitmessage = True`. Incoming messages append to its internal buffer without triggering Python execution.
2. **Deterministic Frame Polling**: Processing occurs inside an `ExecuteDAT` (`osc_processor`) registered exclusively to `onFrameStart`.
3. **Atomic Drain**: At the end of each frame processing cycle, `osc_processor` clears the incoming buffer with `osc_in.par.clear.pulse()`.
4. **Pre-allocated Table Dimensions**: `players_data` is initialized with 101 rows (1 header + 100 slots). Slot indices map directly to row numbers (`slot_N` = row `N`). Tables never resize dynamically during live sessions.

---

## 3. Data Schema & Channel Union

### Numeric CHOP Union (`out_players_chop`)
Downstream generative visual systems (e.g. particle systems, 3D instancing) require invariant channel names and lengths to avoid GPU buffer re-allocation. `out_players_chop` outputs a constant 13 channels across 100 samples:

| Channel | Range | Source Profile | Description |
| :--- | :--- | :--- | :--- |
| `active` | `0.0` or `1.0` | All | `1.0` when slot has an active connected user. |
| `tx` | `-1.0` to `1.0` | Gamepad / Touchpad | Horizontal position or joystick X coordinate. |
| `ty` | `-1.0` to `1.0` | Gamepad / Touchpad | Vertical position or joystick Y coordinate. |
| `b1` | `0.0` or `1.0` | All | Primary button (Action 1 / Flash 1 / Touch Active / Tap). |
| `b2` | `0.0` or `1.0` | All | Secondary button (Action 2 / Flash 2 / Clear / Pulse). |
| `b3` | `0.0` or `1.0` | All | Tertiary button (Action 3 / Feed / Flash 3 / Mode Cycle). |
| `b4` | `0.0` or `1.0` | All | Quaternary button (Special / Flash 4 / Strobe). |
| `s1` | `0.0` to `1.0` | All | Continuous parameter 1 (Speed / Brush / Fader 1). |
| `s2` | `0.0` to `1.0` | Gamepad / Faderbank | Continuous parameter 2 (Size / Fader 2). |
| `s3` | `0.0` to `1.0` | Faderbank | Continuous parameter 3 (Fader 3). |
| `s4` | `0.0` to `1.0` | Faderbank | Continuous parameter 4 (Fader 4 / Master FX). |
| `tap_rate` | `0.0` to `240.0` | Audience | Live BPM / tap rate calculated on device. |
| `rot` | `0.0` to `360.0` | Gamepad / Motion | Orientation angle in degrees. |

*Note: Inactive player slots hold `0.0` across all channels.*

### Dual Channel Compatibility
The Node.js relay emits both canonical union channels and legacy semantic aliases simultaneously:
- `b1` ↔ `action1`
- `b2` ↔ `action2`
- `b3` ↔ `action3`
- `s1` ↔ `slider1`
- `s2` ↔ `slider2`
- `x` ↔ `tx`
- `y` ↔ `ty`

---

## 4. Slot Allocation & Lifecycle Management

- **Slots 1–5**: Reserved for autonomous background bots and choir demo entities.
- **Slots 6–100**: Dynamically assigned to connecting human users.
- **Rate Limiting**: Input packets per client are throttled to a minimum interval of 15ms (~60Hz maximum transmission rate).
- **Heartbeat & Inactivity Sweep**: Clients send pings every 5 seconds. If a client produces no message for >15 seconds, the relay frees the slot, resets its internal state, and transmits zero-value reset packets across all channels for that slot number.
- **Client Blur & Visibility Flush**: The client frontend listens to `document.visibilitychange`. If the user locks their screen or switches tabs, an immediate flush event (`x=0, y=0, b*=0`) is transmitted.

---

## 5. Controller Profile Synchronization

```text
TouchDesigner (/bridge/profile) ──► Node.js Relay ──► WebSocket Broadcast ──► Phone Browsers
```

1. **Hot-Reloading**: The relay broadcasts `{ type: 'profile_change', profile, ui_blueprint }` to all clients.
2. **Zero-State Transition**: The mobile client zeros out its local inputs before replacing DOM elements to prevent stuck values.
3. **Late-Joiner Handshake**: When a new client joins, the handshake response (`assigned_slot`) contains the current session profile and active blueprint, guaranteeing immediate synchronization.
