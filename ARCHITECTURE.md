# TDBridge Technical Architecture

System specification covering network topology, TouchDesigner ingestion models, channel schemas, security controls, and responsive layout scaling.

---

## 1. Network Topology & Port Routing

```text
Phone / Desktop ──(WebSocket, Port 8080)──► Node.js Relay ──(OSC/UDP, Port 9000)──► TouchDesigner
                                                  │                                       │
                                                  ◄──────(OSC/UDP, Port 9001)─────────────┘
```

| Route | Protocol | Default Port | Direction | Purpose | Throttling & Cadence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Client <-> Relay** | WebSocket (`ws://` / `wss://`) | `8080` | Bi-directional | Attendee input packets, FOH operator streaming, REST health endpoints (`/health`, `/telemetry`). | 60Hz per-slot cap, 1024-byte payload limit. |
| **Relay -> TouchDesigner** | OSC over UDP | `9000` | Outbound | Real-time channel updates (`/slot_<N>_<chan>`), scene cues (`/bridge/scene`), environment parameters (`/env/<param>`). | Synchronous on frame receipt. |
| **TouchDesigner -> Relay** | OSC over UDP | `9001` | Inbound | Cook FPS telemetry (`/td/fps`), error alerts (`/td/error`), scene registries (`/td/scene_list`), session title (`/td/session_name`), and Master PIN (`/bridge/master_pin`). | 1000ms heartbeat loop with server-side value-change guards. |
| **Public WAN Ingress** | HTTPS / WSS | `443` | Inbound | Optional Cloudflare tunnel (`bin/cloudflared.exe`) reverse proxying to local port 8080. | Handled by Cloudflare edge. |

---

## 2. TouchDesigner Ingestion & Cook-Loop Immunity

In TouchDesigner, writing to a table inside an `oscinDAT` Python callback that visual operators reference downstream triggers a recursive cook dependency loop:

```text
oscinDAT (callback) ──writes to──► TableDAT ──dirty event──► oscinDAT cooks again (LOCKUP)
```

### Decoupled Ingestion Pipeline

TDBridge completely decouples network packet receipt from data writing:

```text
Incoming UDP Packets
       │
       ▼
[ bridge_osc_in ] (oscinDAT: par.callbacks = '', par.splitmessage = True)
       │  (Passive buffer: Appends rows without executing Python callbacks)
       ▼
[ osc_processor ] (ExecuteDAT: Registered exclusively to onFrameStart)
       │
       ├── Stage 1: Drains incoming rows in a single batch on frame start.
       ├── Stage 2: Updates pre-allocated cells in players_data[slot, col].
       ├── Stage 3: Routes master cues to parent().par or active scene COMPs.
       └── Stage 4: try...finally: bridge_osc_in.par.clear.pulse() (Atomic buffer purge).
```

### Table Dimension Invariant

- `players_data` is initialized with **exactly 101 rows x 15 columns** (Row 0 = headers, Rows 1–100 = Slots 1–100).
- Tables never resize dynamically during runtime, preventing Replicator COMP stalls and GPU memory reallocation spikes.
- Slots 1–5 are reserved for autonomous ambient bots; Slots 6–100 are assigned to human performers.

---

## 3. Data Schema & Channel Union

### Numeric CHOP Union (`out_players_chop`)

Downstream generative visual systems require invariant channel names and lengths. `out_players_chop` outputs a constant **13 channels x 100 samples**:

| Channel | Range | Source Profile | Description |
| :--- | :--- | :--- | :--- |
| `active` | `0.0` or `1.0` | All | `1.0` when slot has an active connected user; `0.0` when idle. |
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
| `tap_rate` | `0.0` to `240.0` | Audience | Live BPM calculated on device from taps. |
| `rot` | `0.0` to `360.0` | Gamepad / Motion | Orientation angle in degrees. |

*Note: Inactive player slots output `0.0` across all channels.*

---

## 4. Attendee Onboarding & Security

### Attendee Onboarding Flow

- The onboarding gate eliminates role bifurcations. Every attendee enters directly as an interactive performer with one click: **`[ ENTER STAGE -> ]`**.
- Human slots are assigned in the range 6–100 (up to 95 concurrent active performers).
- If capacity is reached (95/95 human slots occupied), incoming clients receive a clean rejection notice.

### Security Architecture

1. **Public Room Code (4 characters, e.g. `HJHX`)**: Displayed on screen or QR code for attendee entry. Public participants cannot access master broadcast controls.
2. **Private Master Key (`OP-XXXXXX`) or 4-Digit PIN (`1234`)**: Displayed strictly in the operator terminal and TouchDesigner custom parameters.
3. **Covert FOH Operator Access**: Accessed via a low-opacity `OP-ACCESS` micro-trigger at the bottom-right of the viewport (`opacity: 0.15`), URL parameter (`?key=1234`), or keyboard shortcuts (`Ctrl+Shift+O`, `~`).
4. **Rate Limiting & Lockout**: Sockets failing master authentication 3 consecutive times are disconnected with code `4003`. Remote IPs failing 5 times enter a 60-second cooldown.
5. **Input Sanitization**: Control IDs match `/^[a-zA-Z0-9_-]{1,16}$/`. Slot dictionaries use `Object.create(null)` to prevent prototype pollution. Master Console DOM construction uses strict `textContent` without `innerHTML`.

---

## 5. Dynamic Session Branding

Artists can rebrand the event title from within TouchDesigner without restarting servers:

```text
TouchDesigner (/project1/TDBridge.par.Sessionname)
       │
       ▼  OSC /td/session_name (Port 9001)
Node.js Relay Server (activeSessionName state)
       │
       ├──► Included in /health & /telemetry REST payloads
       ├──► Broadcast in WebSocket handshakes
       │
       ▼
Client Browser Gate (#brand-title) & Stage QR Banner (out_qr_top)
```

---

## 6. Telemetry Stability & Heartbeat Guards

TouchDesigner's `telemetry_exec` broadcasts a 1Hz heartbeat (`/bridge/master_pin`, `/td/scene_list`, `/td/scene_health`).

To prevent terminal redraw thrashing, `src/server/relay.ts` enforces value-change guards on all incoming telemetry:
```typescript
if (msg.address === '/bridge/master_pin' && typeof msg.args[0] === 'string') {
    const rawPin = msg.args[0].trim();
    if (rawPin !== ACTIVE_MASTER_PIN) {
        ACTIVE_MASTER_PIN = rawPin;
        addLog(`[SECURITY] Updated Master PIN (length ${ACTIVE_MASTER_PIN.length})`);
        requestRedraw();
    }
}
```

---

## 7. Responsive Viewport Scaling

The user interface uses fluid CSS tokens across 5 viewport classes:

| Breakpoint Tier | Viewport Min | Card Max-Width | Typography Scale | Target Devices |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` | `clamp(320px, 92vw, 420px)` | Title: `2.0rem`, Code: `1.375rem` | Modern smartphones (19.5:9, 20:9) |
| **Tablet / iPad** | `768px` | `clamp(480px, 58vw, 580px)` | Title: `2.75rem`, Code: `1.75rem` | iPad Mini, iPad 10.2", iPad Pro (4:3) |
| **Desktop FHD** | `1024px` | `clamp(540px, 36vw, 680px)` | Title: `3.25rem`, Code: `2.0rem` | Standard 1080p FHD monitors |
| **Desktop QHD** | `1920px` | `clamp(660px, 32vw, 800px)` | Title: `4.0rem`, Code: `2.5rem` | 1440p QHD displays |
| **4K UHD** | `2560px+` | `clamp(880px, 28vw, 1100px)` | Title: `5.5rem`, Code: `3.5rem` | 4K UHD monitors (3840 x 2160) |

Input fields use `font-size: max(16px, 1rem)` to prevent mobile Safari from auto-zooming on focus.

---

## 8. Self-Healing Scene Engine

Managed by `/project1/TDBridge/scene_manager`:
1. **CHOP Auto-Link**: Scans `/project1` for scene COMPs. If player data is missing, drops `select_bridge` (`selectCHOP`) mapped to `out_players_chop`.
2. **TOP Auto-Wire**: Detects the terminal video output of each scene, ensures it is named `out1` (`outTOP`), and connects it to `/project1/switch_preview`.
3. **Blackout Fallback**: If an active scene errors or is deleted, `TDBridge` falls back to `out_qr_top` to prevent black projection screens.
4. **Template Scaffolding**: `[Create Scene Template]` (`Newscene`) generates a pre-wired Base COMP ready for custom visuals.
