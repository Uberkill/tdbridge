# TDBridge System Documentation & Multi-Agent Audit

Overview of system design, performance bottlenecks identified during multi-agent load testing, and implemented mitigations.

---

## 1. System Architecture Overview

TDBridge connects mobile web browsers to Derivative TouchDesigner via WebSockets and local OSC/UDP for live interactive visuals.

### Core Components
- **Frontend**: Responsive TypeScript client running in mobile Safari, Chrome, and desktop browsers. Receives its interface blueprint dynamically upon connection.
- **Networking**: Local LAN routing (port 8080) with optional Cloudflare WAN tunnel for remote access.
- **Relay Server**: Node.js supervisor (`relay.ts`) handling WebSocket connections, 60Hz input throttling, room code verification, and OSC translation.
- **TouchDesigner Engine**: Processes incoming OSC packets into fixed DAT and CHOP structures driving GPU instancing.

---

## 2. Multi-Agent Audit Findings & Mitigations

During high-concurrency simulation testing (15–100 users), several architectural limits were evaluated and addressed:

### A. TouchDesigner Ingestion Performance
- **Issue: JSON Parsing on Main Render Thread**
  - *Risk*: Parsing hundreds of JSON payloads per second inside TouchDesigner's main cook thread causes frame drops below 60fps.
  - *Mitigation*: The Node.js relay parses JSON and validates schema on the host, converting inputs into lightweight binary OSC UDP packets. TouchDesigner receives pre-formatted numbers and strings with minimal parsing overhead.
- **Issue: Replicator COMP Stalls**
  - *Risk*: Dynamically creating or deleting visual nodes when users connect causes expensive dependency graph re-evaluations and micro-freezes.
  - *Mitigation*: Migrated from Replicator COMPs to **GPU Instancing**. The system maintains a fixed 101-row table (`players_data`) and a fixed 13-channel CHOP (`out_players_chop`). Nodes are never created or destroyed at runtime.

### B. Mobile Browser UX & Lifecycle
- **Issue: Mobile Screen Sleep and Backgrounding**
  - *Risk*: Mobile browsers aggressively pause WebSocket connections when phones lock or switch tabs.
  - *Mitigation*: Implemented Screen Wake Lock API (`navigator.wakeLock`) on supported devices, combined with exponential backoff auto-reconnect on visibility changes.
- **Issue: Pointer Ghosting on Release**
  - *Risk*: Sliding fingers off on-screen buttons instead of lifting cleanly can leave momentary buttons in an active state.
  - *Mitigation*: Hardened event listeners across `pointerup`, `pointercancel`, `lostpointercapture`, and `mouseleave` to guarantee a value of `0` is emitted upon release.

---

## 3. Edge-Case Coverage

- **Room Code Validation**: Sockets presenting invalid or expired 4-character codes receive a `rejected` payload and disconnect cleanly with code `4001`.
- **Dirty Disconnections**: Inactivity watchdog monitors performer silence (>8s) and unauthenticated socket timeouts (15s) to reclaim inactive slots without leaving ghost allocations.
- **Input Sanitization**: Control IDs match strict regexes (`/^[a-zA-Z0-9_-]{1,16}$/`), and dictionary allocations use `Object.create(null)` to protect against prototype pollution.

---

## 4. Customizing UI Controls

The mobile client is data-driven. To add or modify controls:
1. Open the active scene COMP in TouchDesigner.
2. Configure custom parameters or provide a `ui_blueprint` Table DAT with columns: `id`, `type`, `label`, `min`, `max`, `color`.
3. When connected, performer phones automatically render the specified controls.
