# TDBridge Core Component (`TDBridge.tox`)

`TDBridge.tox` is the standalone, universal interactive input component for Derivative TouchDesigner. It connects mobile browsers over WebSockets without requiring mobile app installations, providing 60Hz multi-touch control, dynamic session branding, self-healing multi-scene routing, and Front-of-House (FOH) show management.

---

## Quick Integration (Drag & Drop)

1. **Drop Component:** Drag `TDBridge.tox` into any TouchDesigner network (recommended path: `/project1/TDBridge`).
2. **Start Network Relay:** Double-click `Start_System.bat` in the project root (or run `npm start`).
3. **Verify Link:** Check the component's **`Status`** parameter. It will display `[ONLINE // 60.0 FPS]`.
4. **Hook Up Your Visuals:**
   - Wire your geometry instancers to **`out_players_chop`**.
   - Read entity tables from **`out_players_dat`**.
   - Route video through `/project1/switch_preview` and click **`[Audit & Self-Heal Network]`** (`Autolink`).

---

## Component Parameters Reference

### Page: `Bridge`
| Parameter | Type | Mode | Description |
| :--- | :--- | :--- | :--- |
| **`Sessionname`** | String | Config | Event title (e.g. `MAIN STAGE` or `TOAD LIVE SET`). Broadcasts via `/td/session_name` to sync attendee mobile headers and `out_qr_top`. |
| **`Activescene`** | Menu | Dynamic | Active show scene (`aquarium`, `canvas`, `qr`, or auto-discovered custom scenes). Automatically updates preview switcher and mobile profiles. |
| **`Autolink`** | Pulse | Action | **Audit & Self-Heal Network:** Scans `/project1` for scene COMPs, creates missing player CHOP links (`select_bridge`), auto-wires video `out1` to `switch_preview`, and heals broken references without blackouts. |
| **`Newscene`** | Pulse | Action | **Create Scene Template:** Scaffolds a new generative Base COMP with player inputs and video outputs pre-wired in 1 click. |
| **`Openmaster`** | Pulse | Action | Launches default browser pre-authenticated into the FOH Master Operator Console. |
| **`Masterpin`** | String | Config | Secret 4-digit operator PIN (default: `1234`). Synced to Relay via `/bridge/master_pin` for operator password authentication. |
| **`Scenehealth`** | String | Read-Only | Real-time scene pipeline status (e.g. `[HEALTHY // 3 SCENES LINKED]`). |
| **`Profile`** | Menu | Config | Active controller profile (`gamepad`, `touchpad`, `faderbank`, `audience`, `custom`). Dynamically morphs all connected phones. |
| **`Roomcode`** | String | Read-Only | Active 4-letter public room code (synced live from Relay). |
| **`Status`** | String | Read-Only | Engine heartbeat and cook framerate telemetry. |
| **`Portin`** | Integer | Config | Local OSC UDP port for receiving incoming controls (Default: `9000`). |
| **`Portout`** | Integer | Config | Remote OSC UDP port for transmitting telemetry to Relay (Default: `9001`). |

---

## Output Contracts

### 1. `out_players_chop` (CHOP)
- **Dimensions:** 13 channels $\times$ 100 samples.
- **Channels:** `active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `s3`, `s4`, `tap_rate`, `rot`.
- **Slot Allocation:** Slots 1–5 are reserved for AI bots / ambient motion; Slots 6–100 are reserved for human performers.
- **Clean Inactive States:** Slots without active users output `0.0` across all channels.

### 2. `out_players_dat` (DAT)
- **Dimensions:** Fixed 101 rows (Row 0 = headers, Rows 1–100 = Slots 1–100) $\times$ 15 columns.
- **Columns:** `slot`, `name`, `active`, `tx`, `ty`, `b1`, `b2`, `b3`, `b4`, `s1`, `s2`, `tap_rate`, `r`, `g`, `b`.

### 3. `out_qr_top` (TOP)
- **Dimensions:** 256 $\times$ 256 TOP.
- Displays the room code, QR code, and dynamic `Sessionname` for crowd scanning.

---

## Architectural Guardrails

- **Zero Callback Dependency Loops:** The internal `bridge_osc_in` is configured with `callbacks = ''`. Buffer processing occurs strictly on `onFrameStart` in `osc_processor` with a `clear.pulse()` drain at the end of each frame.
- **Fixed Dimensions:** Tables and CHOPs never resize during runtime. This prevents TouchDesigner Replicator COMP stalls and GPU memory reallocation spikes.
- **Heartbeat Change Guards:** State resyncs every 1000ms (`telemetry_exec`) while Relay enforces change guards to prevent terminal redraw spam.
