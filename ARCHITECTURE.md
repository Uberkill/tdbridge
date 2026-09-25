# TDBridge Technical Architecture

Deep reference for developers and AI agents working on this codebase.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHONE (Browser)                          │
│  index.html + app.js                                            │
│  WebSocket client → sends joystick/button events as JSON        │
└───────────────────────┬─────────────────────────────────────────┘
                        │ WebSocket (wss://)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cloudflare Tunnel (HTTPS)                       │
│  cloudflared.exe tunnels localhost:8080 → public URL            │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP upgrade → WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js relay.ts (port 8080)                       │
│  Express + ws library                                            │
│  • Slot management: 100 slots (slot_1 … slot_100)               │
│  • Rate limiting: 60Hz max per slot                             │
│  • Heartbeat GC: frees slots idle >15s                          │
│  • OSC send: port 9000 → TouchDesigner                          │
│  • OSC recv: port 9001 ← TouchDesigner (telemetry)             │
│  • Terminal dashboard: FPS, errors, active players, QR code     │
└──────────┬─────────────────────────────┬───────────────────────┘
           │ OSC/UDP → port 9000          │ OSC/UDP ← port 9001
           ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TouchDesigner                                  │
│  testing_final.toe → /project1/tdbridge_test                    │
│                                                                  │
│  bridge_osc_in (oscin DAT, passive, NO callbacks)               │
│       ↓ polled every frame by                                    │
│  osc_processor (executeDAT, onFrameStart)                        │
│       ↓ writes to                                               │
│  user_data (tableDAT, 101 rows: header + slot_1…slot_100)       │
│       ↓ filtered by                                             │
│  select_active (selectDAT, rows where name != '')               │
│       ↓ drives                                                  │
│  replicator → spawns player_master clones (item1…itemN)         │
│       ↓ composited by                                           │
│  all_players (compTOP) → out1 → final render                    │
│                                                                  │
│  telemetry_fps_exec → /td/fps every 30 frames → port 9001       │
│  telemetry_err_exec → /td/error (filtered) → port 9001          │
└─────────────────────────────────────────────────────────────────┘
```

---

## OSC Message Format

### Node.js → TouchDesigner (port 9000)

All messages follow `/slot_N_channel value` format.

```
/slot_6_active   1.0          # Player 6 connected
/slot_6_name     "Alice"      # Player 6's display name
/slot_6_x        0.73         # Joystick X (-1.0 to 1.0)
/slot_6_y       -0.45         # Joystick Y (-1.0 to 1.0)
/slot_6_action1  1.0          # ROTATE button pressed
/slot_6_action2  0.0          # PULSE COLOR not pressed
/slot_6_slider1  0.8          # SPEED slider value
/slot_0_room_code "JD89"      # Heartbeat (slot 0 = system)
```

### TouchDesigner → Node.js (port 9001)

```
/td/fps    60.0               # Engine cook rate
/td/error  "message string"   # Real errors only (warnings filtered)
```

---

## user_data Table Schema

`/project1/tdbridge_test/user_data` — 101 rows (row 0 = header, rows 1–100 = slots).

| Column | Type | Description |
|---|---|---|
| `client` | string | Slot ID: `"slot_1"` … `"slot_100"` |
| `name` | string | Player display name (empty = slot free) |
| `x` | float string | World X position |
| `y` | float string | World Y position |
| `color_h` | float string | Hue override |
| `r`, `g`, `b` | float string | RGB color |
| `rotate_vis` | float string | Rotate action value |
| `action1` | float string | Action button 1 |
| `action2` | float string | Action button 2 |
| `slider1` | float string | Speed slider |
| *(col 12)* | — | Empty column — **do not access by name** |
| `last_seen` | string | ISO timestamp of last message |
| `joystick_x` | float string | Raw joystick X (mirrored from x) |
| `joystick_y` | float string | Raw joystick Y (mirrored from y) |

**Initialization:** `startup_init` (executeDAT at `/project1`) runs `onStart` every project open and pre-fills all 100 rows with clean zeroed data plus 5 demo bot names in slots 1–5.

---

## The Cook Loop Problem (and the Permanent Fix)

### Why it happened

TouchDesigner builds a dependency graph for every cook frame. When an `oscin` DAT fires its callback, TD notes which OPs are referenced by the script. If any of those OPs change during the callback (e.g., a table DAT gets a row appended), TD marks the `oscin` DAT as dirty → it re-cooks → fires the callback again → **infinite loop**.

Every naive fix fails:
- Write to `user_data` directly → immediate loop
- Write to a separate queue Table DAT → TD still tracks the table reference in script
- Use `run(..., delayFrames=1)` → the `run()` reference itself is tracked
- Use `op.store()` → works, BUT new OSC packets arriving during the callback frame still caused TD to flag the `oscin` as self-dependent in build 2025.32460

### The permanent fix

**`bridge_osc_in` has NO callbacks set (`par.callbacks = ''`).**

It is a pure passive buffer — rows accumulate, no script runs. `osc_processor` (an `executeDAT`) polls `bridge_osc_in` every frame in `onFrameStart`, reads all pending rows, processes them, and writes to `user_data`. Because `osc_processor` is a completely separate node that is never in the `oscin` DAT's dependency chain, there is no loop possible.

---

## Replicator Behavior

- `par.method = 'bytable'` → reads row count from `select_active`
- `par.ignorefirstrow = True` → skips the header row
- `par.namefromtable = 'rowindex'` → clones named `item1`, `item2`, etc.
- `par.master = 'player_master'` → template clone
- `par.callbacks = 'replicator_callbacks'` → wires each clone's `out1` to `all_players`

When real player count changes (slots 6+), `osc_processor` calls `rep.par.recreateall.pulse()`. This destroys and recreates all clones — takes about 1 frame. Bot clones (slots 1–5) are included in the recreate. `bot_motion` immediately resumes animating them the next frame.

**Important:** Clones do NOT inherit parameter changes made to `player_master` after they are spawned. If you change `player_master`, pulse `recreateall`.

---

## Demo Bots

Slots 1–5 are reserved for `Nemo`, `Dory`, `Marlin`, `Gill`, `Bubbles`. `bot_motion` (executeDAT) orbits them in a circle every frame using `frame * 0.003` as the time parameter. If a real player is assigned to one of those slots, `bot_motion` skips that slot. `startup_init` re-initializes the bot names on every project open.

---

## Telemetry Pipeline

```
project.cookRate
      ↓
telemetry_fps_exec (executeDAT, every 30 frames)
      ↓ sendOSC('/td/fps', [fps])
telemetry_osc_out (oscout DAT → 127.0.0.1:9001)
      ↓ UDP → Node.js port 9001
      ↓ parsed in relay.ts → shown in terminal dashboard

telemetry_error (errorDAT, all TD errors)
      ↓
telemetry_err_exec (datexec DAT, onTableChange)
      ↓ filters: cook loop warnings, SOP collision warnings, severity=='warning'
      ↓ sendOSC('/td/error', [message])
telemetry_osc_out → Node.js
```

---

## startup_init Self-Healing

`/project1/startup_init` runs `onStart()` every time the `.toe` opens. It:
1. Verifies `user_data` has 101 rows — rebuilds if not
2. Initializes `op.store('osc_msgs', [])` to clear any stale OSC queue
3. Sets bot names in slots 1–5
4. Ensures `select_active` has correct `rowexpr`
5. Ensures `replicator` is in `bytable` mode pointing to `select_active`
6. Pulses `physics_world.par.start` to start the physics simulation

This means the project is **self-healing on open** — no manual setup required after loading the `.toe`.

---

## relay.ts Key Internals

| Variable | Purpose |
|---|---|
| `MAX_USERS` | 100 (slots 1–100) |
| `ACTIVE_ROOM_CODE` | Random 4-char alphanumeric, generated at startup |
| `slots[]` | Array of 100 `SlotState` objects |
| `HEARTBEAT_INTERVAL` | 5000ms — GC sweep runs every 5 seconds |
| `SLOT_TIMEOUT` | 15000ms — slots idle >15s are freed |
| `MIN_MSG_INTERVAL` | 15ms — enforces 60Hz rate limit per slot |

### Slot lifecycle

1. Player opens URL → WebSocket connect → `assignSlot()` → `sendOSC('/slot_N_active', 1)` → `sendOSC('/slot_N_name', name)`
2. Player sends control → rate-limited → `sendOSC('/slot_N_channel', value)`
3. Player disconnects → `freeSlot()` → `sendOSC('/slot_N_active', 0)` → all columns zeroed in `user_data`
4. GC heartbeat → any slot with `lastSeen > 15s` → force-freed

---

## Known Limitations

| Issue | Status | Notes |
|---|---|---|
| SOP collision shape warning | Cosmetic only | Physics still works. TD build 2025.32460 bug. |
| FPS shows NaN on first open | Auto-clears in ~30 frames | `telemetry_fps_exec` fires after first 30 frames |
| Clones flash briefly on `recreateall` | 1-frame flicker | Only happens when player count changes |
| `item6+` clones need `replicator_callbacks` to wire them | Done automatically | `onReplicate` handles this |
