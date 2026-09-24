# TDBridge: Complete System Documentation & Multi-Agent Audit Report

## 1. System Architecture Overview
The **TDBridge** is a modular, high-performance web-to-TouchDesigner integration. It creates a robust WebSocket pipeline allowing up to 100 mobile users to connect to a live TouchDesigner session without installing an app. 

### Core Components
- **Frontend:** A TypeScript/HTML5 web application hosted on GitHub Pages. It acts as a blank canvas, receiving its entire UI blueprint from the server upon connection. Features NippleJS for joystick input.
- **Networking:** Cloudflare Tunnels secure a fast, local-to-internet bridge (`trycloudflare.com`), bypassing standard NAT and firewall routing.
- **Backend:** A pure-Python WebSocket Server DAT inside TouchDesigner that reads payloads, updates a centralized `user_data` Table DAT, and drives visual parameters.
- **Visual Engine:** A Replicator COMP architecture that dynamically clones player avatars (`item1`, `item2`) on the fly based on the `user_data` table.

## 2. Multi-Agent Audit Findings
We ran a rigorous multi-agent stress test simulating a 15+ concurrent user load. The agents identified critical scaling limits and provided architectural fixes.

### A. TouchDesigner Backend Performance (Auditor: TD Performance Agent)
- **Bottleneck 1: JSON Parsing on Main Thread**
  - *Risk:* 15 users sending 30 payloads a second = 450 JSON strings parsed per second. Doing this inside `onReceiveText` (the main render thread) will cause micro-stutters and drop the frame rate below 60fps.
  - *Patch/Next Step:* Offload incoming WebSocket strings into a lightweight Python `collections.deque` and batch-process them only once per frame using an Execute DAT (`onFrameStart`).
- **Bottleneck 2: Replicator Stalls**
  - *Risk:* The Replicator COMP physically deletes and recreates nodes in the TouchDesigner network when users join or leave. This triggers massive dependency graph re-evaluations and will freeze the screen for 50-100ms when players join.
  - *Patch/Next Step:* Migrate from `Replicator COMP` to **GPU Instancing**. We will pre-allocate 100 fixed slots in a CHOP, and use an `Active` toggle to hide/show them. This incurs 0% CPU node-creation cost and runs entirely on the GPU.

### B. Frontend & Mobile UX (Auditor: Mobile UX Agent)
- **Bottleneck 1: Connection Dropping on Screen Sleep**
  - *Risk:* Mobile Safari/Chrome aggressively suspends WebSocket connections if the user locks their screen or switches apps.
  - *Current Mitigation:* We implemented a `visibilitychange` listener in `app.ts` that immediately pings the server and triggers a full reconnect sequence the second the user brings the browser back into view. We also implemented `wakeLock` to prevent the screen from sleeping.
- **Bottleneck 2: Stuck UI Elements (Multi-touch Ghosting)**
  - *Risk:* Dragging a finger off a button instead of lifting it causes "stuck" states (value remains 1 indefinitely).
  - *Current Mitigation:* `app.ts` is explicitly hardened with `touchend`, `touchcancel`, and `mouseleave` event hooks to mathematically guarantee a 0 is fired on release.

## 3. End-to-End Test Cases & Coverage
- **Edge Case 1: Room Code Validation.** If a user types the wrong 4-letter code, the WebSocket successfully handshakes but instantly sends a `rejected` payload and severs the connection cleanly.
- **Edge Case 2: Ghost Clients.** If a mobile phone loses 4G service and drops the WebSocket without a `close` packet, the backend `onWebSocketClose` natively catches the broken pipe and cleanly purges the user from the `user_data` DAT.
- **Edge Case 3: Malformed UI Input.** If a malicious user attempts to send `{"type": "control", "id": "hack_system", "value": 9999}`, the backend strictly scans against the `ui_config` DAT schema. Unregistered IDs are safely ignored, preventing Python exceptions.

## 4. How to Create Custom UI Controls
The frontend is 100% data-driven. To add a new button or slider to the mobile app:
1. Open the `ui_config` Table DAT in TouchDesigner.
2. Add a new row.
   - `id`: internal reference name (e.g. `slider_volume`)
   - `type`: `button` or `slider`
   - `label`: Display text on the phone (e.g. "Volume")
   - `min` / `max`: Range parameters (only needed for sliders)
3. Save the DAT. The next time a phone connects, the button will dynamically generate on their screen, and their inputs will seamlessly flow into the `user_data` table.

## 5. Version Control Strategy
Git is officially initialized on the local TouchDesigner file directory.
- `TDBridge.tox`: The core logic container. Version controlled and fully portable.
- `testing.toe`: The master project file. Version controlled.
- **Workflow:** Prior to making large architectural changes (like migrating to GPU Instancing), run `git commit -a -m "Message"` locally to snapshot the working stable state.
