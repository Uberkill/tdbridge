# TDBridge Technical Architecture & Systems Engineering Specification

Comprehensive engineering specification of network protocols, TouchDesigner execution patterns, data schemas, security models, responsive layouts, and reliability guarantees.

---

## 1. Network Topology & Port Routing

```text
Phone / Desktop ──(WebSocket, Port 8080)──► Node.js Relay ──(OSC/UDP, Port 9000)──► TouchDesigner
                                                  │                                       │
                                                  ◄──────(OSC/UDP, Port 9001)─────────────┘
```

| Route | Protocol | Default Port | Direction | Purpose | Throttling & Cadence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Client $\leftrightarrow$ Relay** | WebSocket (`ws://` / `wss://`) | `8080` | Bi-directional | Attendee input packets, FOH operator streaming, REST health endpoints (`/health`, `/telemetry`). | 60Hz per slot cap, 1024-byte payload limit. |
| **Relay $\rightarrow$ TouchDesigner** | OSC over UDP | `9000` | Egress | Real-time channel updates (`/slot_<N>_<chan>`), scene cues (`/bridge/scene`), environment parameters (`/env/<param>`). | Synchronous on frame/packet receipt. |
| **TouchDesigner $\rightarrow$ Relay** | OSC over UDP | `9001` | Ingress | Cook FPS telemetry (`/td/fps`), error alerts (`/td/error`), scene registries (`/td/scene_list`), session title (`/td/session_name`), and Master PIN (`/bridge/master_pin`). | 1000ms heartbeat loop (with server-side value-change guards). |
| **Public Ingress** | HTTPS / WSS | `443` | Ingress | Optional Cloudflare tunnel (`bin/cloudflared.exe`) reverse proxying to local port 8080. | Handled by Cloudflare edge. |
| **MCP Test Bridge** | HTTP / REST | `9980` | Ingress | Local WebServer DAT inside TouchDesigner for deterministic automated testing. | On-demand test invocation. |

---

## 2. TouchDesigner Ingestion & Cook-Loop Immunity

A classic vulnerability in TouchDesigner OSC architectures occurs when an `oscinDAT` modifies a table referenced by downstream visual components during callback execution, creating an infinite recursive cook dependency loop:

```text
oscinDAT (callback) ──writes to──► TableDAT ──dirty event──► oscinDAT cooks again (LOCKUP)
```

### Decoupled Ingestion Pipeline
TDBridge enforces a strictly decoupled, 4-stage ingestion model:

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
- `players_data` is initialized with **exactly 101 rows $\times$ 15 columns** (Row 0 = headers, Rows 1–100 = Slots 1–100).
- Dynamic row insertion or deletion is strictly forbidden to prevent Replicator COMP stalls and GPU memory reallocation spikes.
- Slots 1–5 are reserved for autonomous AI bots and ambient particle guides; Slots 6–100 are assigned to human performers.

---

## 3. Data Schema & Channel Union

### Numeric CHOP Union (`out_players_chop`)
Downstream generative visual systems require invariant channel names and lengths. `out_players_chop` outputs a constant **13 channels $\times$ 100 samples**:

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

## 4. Single-Action Attendee Ingress & Dual-Code Security

### Single-Action Onboarding Flow
- The onboarding gate eliminates role bifurcations (`[01 // PERFORMER]` vs `[02 // SPECTATOR]`). Every attendee joins directly as a full interactive Performer with one click: **`[ ENTER STAGE -> ]`**.
- Human slots are assigned in the range 6–100 (up to 95 concurrent active performers).
- If venue capacity is reached (95/95 slots full), incoming clients receive a clean rejection notice (`ROOM FULL // 95/95 SLOTS OCCUPIED`).

### Dual-Code Security Matrix
1. **Public Room Code (4 characters, e.g. `HJHX`):** Displayed on screen/QR for attendee entry. Public participants have zero access to master broadcast cues or roster moderation.
2. **Private Master Key (`OP-XXXXXX`) or 4-Digit PIN (`1234`):** Displayed strictly in the operator terminal and TouchDesigner custom parameters.
3. **Covert FOH Operator Access:** Accessed via a low-opacity `OP-ACCESS` micro-trigger at the bottom-right of the viewport (`opacity: 0.15`), URL parameter (`?key=1234`), or keyboard shortcuts (`Ctrl+Shift+O`, `~`).
4. **Brute-Force & Flood Hardening:** Sockets failing master authentication 3 consecutive times are terminated with code `4003`. Remote IPs failing 5 times enter a 60-second lockout.
5. **Zero-Trust Sanitation:** Control IDs match `/^[a-zA-Z0-9_-]{1,16}$/`. Object allocations use `Object.create(null)` to neutralize prototype pollution. Master Console DOM construction uses strict `textContent` (zero `innerHTML`).

---

## 5. Dynamic Session Branding Architecture

Artists can rebrand the entire live event dynamically from within TouchDesigner:

```text
TouchDesigner (/project1/TDBridge.par.Sessionname)
       │
       ▼  OSC /td/session_name (Port 9001)
Node.js Relay Server (activeSessionName state)
       │
       ├──► Included in /health & /telemetry REST payloads
       ├──► Broadcast in WebSocket handshakes (assigned_slot, master_login_success)
       │
       ▼
Client Browser Gate (#brand-title) & Stage QR Banner (out_qr_top)
```

Updating `Sessionname` in TouchDesigner instantly updates the attendee welcome screen and the stage projection banner with zero server restarts.

---

## 6. Telemetry Stability & Heartbeat Guards

TouchDesigner's `telemetry_exec` broadcasts a 1Hz failover heartbeat (`/bridge/master_pin`, `/td/scene_list`, `/td/scene_health`).

To prevent terminal thrashing and live telemetry ring-buffer eviction, `src/server/relay.ts` enforces strict **Value-Change Guards**:
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
The failover heartbeat continues uninterrupted, while diagnostic logs remain 100% clean and free of repetitive spam.

---

## 7. Universal Responsive Viewport Scaling

The user interface utilizes a fluid CSS custom property hierarchy across 5 viewport classes:

| Breakpoint Tier | Viewport Min | Card Max-Width | Typography Scale | Target Hardware |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` | `clamp(320px, 92vw, 420px)` | Title: `2.0rem`, Code: `1.375rem` | iPhone 14/15/16 Pro (19.5:9), Android (~20:9) |
| **Tablet / iPad** | `768px` | `clamp(480px, 58vw, 580px)` | Title: `2.75rem`, Code: `1.75rem` | iPad Mini, iPad 10.2", iPad Pro (4:3 ratio) |
| **Desktop FHD** | `1024px` | `clamp(540px, 36vw, 680px)` | Title: `3.25rem`, Code: `2.0rem` | Standard 1080p FHD monitors |
| **Desktop QHD** | `1920px` | `clamp(660px, 32vw, 800px)` | Title: `4.0rem`, Code: `2.5rem` | 1440p QHD displays |
| **4K UHD** | `2560px+` | `clamp(880px, 28vw, 1100px)` | Title: `5.5rem`, Code: `3.5rem` | 4K UHD monitors (3840 $\times$ 2160) |

- **Centering & Scroll Protection:** Card uses `margin: auto; max-height: calc(100dvh - 32px); overflow-y: auto;` to eliminate top-clipping on short or landscape viewports.
- **iOS Safari Touch Protection:** Input fields enforce `font-size: max(16px, 1rem)` to eliminate mobile browser auto-zoom.

---

## 8. Self-Healing Scene Engine

Managed by `/project1/TDBridge/scene_manager`:
1. **Green Wire Auto-Link (CHOPs):** Scans `/project1` for scene COMPs. If player data is missing, drops `select_bridge` (`selectCHOP`) mapped to `out_players_chop`.
2. **Purple Wire Auto-Wire (TOPs):** Detects the terminal video output of each scene, ensures it is named `out1` (`outTOP`), and connects it to `/project1/switch_preview`.
3. **Failover Protection:** If an active scene throws a fatal cook exception or is deleted, `TDBridge` routes `switch_preview` to a safe fallback (e.g. `out_qr_top`), preventing projection blackouts.
4. **1-Click Template Scaffolding:** `[Create Scene Template]` (`Newscene`) generates a pre-wired Base COMP ready for custom visual design.

---

## 9. Codebase Navigation with Graphify

The codebase is indexed as a persistent knowledge graph in `graphify-out/`:
- **Interactive D3 Map:** `graphify-out/graph.html`
- **Subsystem Communities:** 84 communities spanning Client DOM, Relay Core, Control Profiles, and TouchDesigner Scripts.
- **Query CLI:** `python -m graphify query "<question>"` traverses the graph using breadth-first search.
- **Audit Ledger:** `graphify-out/GRAPH_REPORT.md` details all god nodes and subsystem bridge points.
