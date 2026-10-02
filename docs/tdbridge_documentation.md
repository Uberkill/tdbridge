# TDBridge Technical Architecture & Systems Engineering Specification

**Document Version:** 2.5.0 (Production Release)  
**Target Environment:** Node.js 18+ / TouchDesigner 2023+ & 2025+ on Windows 10/11  
**Quality Gate:** 100% Deterministic Pass across 9 Test Domains (`npm test`)

---

## 1. System Topology & Communication Matrix

TDBridge splits the high-concurrency mobile interaction pipeline from the real-time visual rendering pipeline to guarantee stable 60 FPS performance.

```text
┌─────────────────┐       WebSocket (Port 8080)       ┌────────────────────────┐
│  Mobile / 4K UI │ ◄───────────────────────────────► │   Node.js Relay Server │
└─────────────────┘                                   └────────────────────────┘
                                                              │        ▲
                                            OSC UDP Port 9000 │        │ OSC UDP Port 9001
                                            (/slot_*, /env/*) │        │ (/td/fps, /td/scene_list,
                                                              ▼        │  /td/session_name)
                                                      ┌────────────────────────┐
                                                      │  TouchDesigner Engine  │
                                                      │  (TDBridge.toe / .tox) │
                                                      └────────────────────────┘
```

### Port Routing Table
| Port | Protocol | Binding Direction | Purpose | Throttling & Cadence |
| :--- | :--- | :--- | :--- | :--- |
| **8080** | HTTP / WebSocket | Client $\leftrightarrow$ Relay | Attendee handshakes, control packets, FOH operator streaming, telemetry REST API (`/health`, `/telemetry`). | 60Hz per slot cap, 1024-byte payload limit. |
| **9000** | OSC over UDP | Relay $\rightarrow$ TouchDesigner | Translates client inputs to `/slot_<N>_<chan>`, scene cues to `/bridge/scene`, and master environment cues to `/env/<param>`. | Synchronous on packet ingress. |
| **9001** | OSC over UDP | TouchDesigner $\rightarrow$ Relay | Telemetry heartbeats (`/td/fps`), error alerts (`/td/error`), scene registries (`/td/scene_list`), session title (`/td/session_name`), and Master PIN (`/bridge/master_pin`). | 1000ms periodic heartbeat loop (with server-side value-change guards). |
| **9980** | HTTP / REST | MCP Tool $\leftrightarrow$ TouchDesigner | WebServer DAT bridge for automated programmatic test execution and inspection. | On-demand test invocation. |

---

## 2. TouchDesigner Engine Architecture: Cook-Loop Prevention

### The Problem
In standard TouchDesigner configurations, attaching a Python callback to an `oscinDAT` that writes into a downstream `TableDAT` marks the table as "dirty". If any operator downstream references this table, it forces the `oscinDAT` to re-cook, creating an infinite cook dependency loop. This causes the main render loop to freeze, drops the frame rate from 60 FPS to 12 FPS, and eventually locks the UDP socket.

### The Solution: Passive FIFO & Atomic Frame Draining
TDBridge enforces a strictly decoupled, 4-stage ingestion model:

```text
Incoming UDP Packets
       │
       ▼
[ bridge_osc_in ] (oscinDAT: par.callbacks = '', par.splitmessage = True)
       │  (Passive buffer: Appends rows without executing any Python callbacks)
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
- Rows are never appended or deleted dynamically. Row $N$ always corresponds to Slot $N$.
- This avoids Replicator COMP stalls and prevents dynamic CHOP buffer allocations on the GPU.

---

## 3. Dynamic Session Branding & Parameter Architecture

Event branding is dynamically driven by the TouchDesigner engine:
- The `/project1/TDBridge` component exposes a custom parameter: **`Sessionname`** (String, default: `MAIN STAGE`).
- On value change or 1Hz heartbeat, `telemetry_exec` broadcasts:
  ```python
  osc_out.sendOSC('/td/session_name', [str(parent().par.Sessionname.eval())])
  ```
- `src/server/relay.ts` ingests this packet, updates internal `activeSessionName` state, exposes it in `/health` and `/telemetry`, and streams it in the WebSocket handshake payload (`assigned_slot` and `master_login_success`).
- The attendee browser immediately updates `#brand-title` in real time, while `out_qr_top` renders the title directly above the stage QR code.

---

## 4. Telemetry Stability & Heartbeat Guards

TouchDesigner broadcasts a 1Hz failover heartbeat (`/bridge/master_pin`, `/td/scene_list`, `/td/scene_health`).

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

## 5. Universal Responsive Viewport Scaling

The user interface implements a fluid CSS custom property hierarchy across 5 viewport classes:

| Breakpoint Tier | Viewport Min | Card Max-Width | Typography Scale | Target Hardware |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` | `clamp(320px, 92vw, 420px)` | Title: `2.0rem`, Code: `1.375rem` | iPhone 14/15/16 Pro (19.5:9), Android (~20:9) |
| **Tablet / iPad** | `768px` | `clamp(480px, 58vw, 580px)` | Title: `2.75rem`, Code: `1.75rem` | iPad Mini, iPad 10.2", iPad Pro (4:3 ratio) |
| **Desktop FHD** | `1024px` | `clamp(540px, 36vw, 680px)` | Title: `3.25rem`, Code: `2.0rem` | Standard 1080p FHD monitors |
| **Desktop QHD** | `1920px` | `clamp(660px, 32vw, 800px)` | Title: `4.0rem`, Code: `2.5rem` | 1440p QHD displays |
| **4K UHD** | `2560px+` | `clamp(880px, 28vw, 1100px)` | Title: `5.5rem`, Code: `3.5rem` | 4K UHD monitors (3840 $\times$ 2160) |

- **Centering & Scroll Protection:** The main card uses `margin: auto; max-height: calc(100dvh - 32px); overflow-y: auto;` to prevent top-clipping on short or landscape viewports.
- **iOS Safari Touch Protection:** Input fields enforce `font-size: max(16px, 1rem)` to eliminate mobile browser auto-zoom.

---

## 6. Dual-Code Security & Zero-Trust Defense Matrix

| Attack Vector | Vulnerability Risk | Mitigation Implementation in TDBridge |
| :--- | :--- | :--- |
| **Cross-Client Impersonation** | Malicious users claiming another performer's slot or overriding control channels. | **Deferred Slot Reservation:** Sockets are unauthenticated until valid room handshake. Sockets map strictly to internal `socketToSlot` Map. Incoming control messages must match the socket's assigned slot. |
| **Credential Brute-Forcing** | Automated scripts guessing the 4-digit Master PIN or room code. | **Connection-Level Rate Limiting:** Sockets failing master authentication 3 consecutive times are terminated with code `4003`. Remote IPs failing 5 times enter a 60-second lockout. |
| **OSC Path Traversal / Injection** | Malicious JSON keys (e.g. `../../param`) corrupting internal TouchDesigner paths. | **Strict Regex Whitelisting:** Control IDs must match `/^[a-zA-Z0-9_-]{1,16}$/`. Environment parameters must match `/^[a-zA-Z0-9_]{1,24}$/`. Traversal characters (`/`, `\`, `.`) are rejected. |
| **Prototype Pollution** | Corrupting Node.js `Object.prototype` via `__proto__` or `constructor` keys. | **Prototype-Free Slot State:** Slot dictionaries are allocated strictly via `Object.create(null)`. Payloads containing `__proto__`, `constructor`, or `prototype` are dropped. |
| **XSS in Operator Console** | Malicious player handles executing scripts on the FOH Master Console. | **Zero innerHTML:** The FOH Master Console builds all roster rows, handles, and telemetry badges strictly using `document.createElement()` and `textContent`. |
| **Covert Operator Access** | Public attendees accidentally accessing or being distracted by FOH controls. | **Covert Micro-Trigger:** Replaced prominent operator button with discreet `OP-ACCESS` micro-trigger at bottom-right (`opacity: 0.15`), URL parameter (`?key=1234`), or keyboard shortcuts (`Ctrl+Shift+O`, `~`). |

---

## 7. The 9-Domain Unified Master Test Suite

The test suite (`node tests/master_test_runner.js`, wired to `npm test`) enforces a strict quality gate:

```text
====================================================================
            TDBRIDGE MASTER TEST EXECUTION SUMMARY              
====================================================================
  [PASS] [01] DOMAIN 1: UNIT & PROTOCOL VALIDATION
       • Tests client blueprint sanitization, slider normalization, and profile schema parsing.
  [PASS] [02] DOMAIN 2: ZERO-TRUST SECURITY & INJECTION
       • Tests prototype pollution defense, regex whitelisting, and unauthorized host command rejection.
  [PASS] [03] DOMAIN 3: FOH MASTER CONSOLE & REMOTE KICK
       • Tests Master Key authentication, session token binding, live roster streaming, and slot kicking.
  [PASS] [04] DOMAIN 4: 4-DOMAIN TELEMETRY & PORT HYGIENE
       • Tests GET /telemetry schema, cook FPS measurement, UDP port cleanup, and client error beacons.
  [PASS] [05] DOMAIN 5: ENGINE REMEDIATION & INVARIANTS
       • Tests TouchDesigner 101x15 table schema, 13x100 CHOP channels, and zero ghost entity cleanup.
  [PASS] [06] DOMAIN 6: MULTI-PLAYER SCENARIOS & PROFILES
       • Tests 100-player concurrency, slot gap resilience, and interactive feeding scenarios.
  [PASS] [07] DOMAIN 7: HEADLESS PLAYWRIGHT BROWSER UI
       • Headless browser testing verifying 0 console errors, modal behaviors, and responsive DOM rendering.
  [PASS] [08] DOMAIN 8: HYBRID MULTI-SCENE & PARTICLE CANVAS
       • Tests bi-directional scene switching (Aquarium <-> Canvas <-> QR) and late-joiner synchronization.
  [PASS] [09] DOMAIN 9: SELF-HEALING ARCHITECTURE & MASTER PIN
       • Tests 4-digit PIN auth, brute-force kick, automatic scene repair, and failover protection.
--------------------------------------------------------------------
TOTAL RESULT: 9/9 DOMAINS PASSED (100% DETERMINISTIC PASS)
====================================================================
```

---

## 8. Codebase Navigation with Graphify

The codebase is indexed as a persistent knowledge graph in `graphify-out/`:
- **Interactive D3 Map:** [`graphify-out/graph.html`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/graphify-out/graph.html)
- **Subsystem Communities:** 84 communities spanning Client DOM, Relay Core, Control Profiles, and TouchDesigner Scripts.
- **Query CLI:** `python -m graphify query "<question>"` traverses the graph using breadth-first search.
- **Audit Ledger:** [`graphify-out/GRAPH_REPORT.md`](file:///C:/Users/oob/.gemini/antigravity/scratch/TDBridge/graphify-out/GRAPH_REPORT.md) details all god nodes and subsystem bridge points.
