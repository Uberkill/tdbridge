# TDBridge Technical Architecture & Systems Engineering Specification

**Document Version:** 2.4.0 (Production Release)  
**Target Environment:** Node.js 18+ / TouchDesigner 2023+ & 2025+ on Windows 10/11  
**Quality Gate:** 100% Deterministic Pass across 9 Test Domains (`npm test`)

---

## 1. System Topology & Communication Matrix

TDBridge splits the high-concurrency mobile interaction pipeline from the real-time visual rendering pipeline to guarantee stable 60 FPS performance.

```text
┌─────────────────┐       WebSocket (Port 8080)       ┌────────────────────────┐
│  Mobile Browser │ ◄───────────────────────────────► │   Node.js Relay Server │
└─────────────────┘                                   └────────────────────────┘
                                                              │        ▲
                                            OSC UDP Port 9000 │        │ OSC UDP Port 9001
                                            (/slot_*, /env/*) │        │ (/td/fps, /td/scene_list)
                                                              ▼        │
                                                      ┌────────────────────────┐
                                                      │  TouchDesigner Engine  │
                                                      │  (TDBridge.toe / .tox) │
                                                      └────────────────────────┘
```

### Port Routing Table
| Port | Protocol | Binding Direction | Purpose | Throttling & Cadence |
| :--- | :--- | :--- | :--- | :--- |
| **8080** | HTTP / WebSocket | Client $\leftrightarrow$ Relay | Attendee handshakes, control packets, FOH operator streaming, telemetry REST API (`/health`, `/telemetry`). | 60Hz per slot cap, 1024-byte payload limit. |
| **9000** | OSC over UDP | Relay $\rightarrow$ TouchDesigner | Translates client inputs to `/slot_<N>_<chan>` and master environment cues to `/env/<param>`. | 60Hz synchronous packet emission. |
| **9001** | OSC over UDP | TouchDesigner $\rightarrow$ Relay | Telemetry heartbeats (`/td/fps`, `/td/clones`), error alerts (`/td/error`), scene registries (`/td/scene_list`), and PIN sync. | 1000ms periodic heartbeat loop. |
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
- `players_data` is initialized with **exactly 101 rows $\times$ 15 columns**.
- Rows are never appended or deleted dynamically. Row $N$ always corresponds to Slot $N$.
- This avoids Replicator COMP stalls and prevents dynamic CHOP buffer allocations on the GPU.

---

## 3. Dual-Code Security & Zero-Trust Defense Matrix

| Attack Vector | Vulnerability Risk | Mitigation Implementation in TDBridge |
| :--- | :--- | :--- |
| **Cross-Client Impersonation** | Malicious users claiming another performer's slot or overriding control channels. | **Deferred Slot Reservation:** Sockets are unauthenticated until valid room handshake. Sockets map strictly to internal `socketToSlot` Map. Incoming control messages must match the socket's assigned slot. |
| **Credential Brute-Forcing** | Automated scripts guessing the 4-digit Master PIN or room code. | **Connection-Level Rate Limiting:** Sockets failing master authentication 3 consecutive times are terminated with code `4003`. Remote IPs failing 5 times enter a 60-second lockout. |
| **OSC Path Traversal / Injection** | Malicious JSON keys (e.g. `../../param`) corrupting internal TouchDesigner paths. | **Strict Regex Whitelisting:** Control IDs must match `/^[a-zA-Z0-9_-]{1,16}$/`. Environment parameters must match `/^[a-zA-Z0-9_]{1,24}$/`. Traversal characters (`/`, `\`, `.`) are rejected. |
| **Prototype Pollution** | Corrupting Node.js `Object.prototype` via `__proto__` or `constructor` keys. | **Prototype-Free Slot State:** Slot dictionaries are allocated strictly via `Object.create(null)`. Payloads containing `__proto__`, `constructor`, or `prototype` are dropped. |
| **XSS in Operator Console** | Malicious player handles executing scripts on the FOH Master Console. | **Zero innerHTML:** The FOH Master Console builds all roster rows, handles, and telemetry badges strictly using `document.createElement()` and `textContent`. |
| **Denial of Service (DoS) Flood** | Rapid client taps flooding the WebSocket server or TouchDesigner buffer. | **Per-Client Rate Limiting:** Performer input messages are clamped to a minimum interval of 15ms (~60Hz). Audience spectator taps are rate-limited to $\le 10$ taps/second. Oversized frames ($> 1024$ bytes) are dropped. |

---

## 4. The 9-Domain Unified Master Test Suite

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
