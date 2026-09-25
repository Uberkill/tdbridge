# TDBridge — Onboarding Guide

This document is the complete handover guide for a new developer, a new AI agent, or any collaborator picking up this project cold.

---

## What This Project Is

TDBridge is a **multiplayer live-control system for TouchDesigner**. Up to 100 people simultaneously connect via their phone browser, get a joystick/button controller, and their inputs drive interactive fish-like visuals inside a TouchDesigner scene — in real time, no app install required.

**The system has two halves:**
1. **Node.js relay** (`src/server/relay.ts`) — handles all web connections
2. **TouchDesigner** (`testing_final.toe`) — handles all visuals and physics

They talk to each other exclusively over **OSC/UDP**. They do not share a process, memory, or HTTP connection.

---

## Before You Do Anything

Read these two files:
- [`README.md`](README.md) — quick start, project structure, OSC reference
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — deep technical breakdown of every component

---

## How to Start the System

1. Open a terminal in this folder
2. Run `Start_System.bat` — this starts Node.js + Cloudflare tunnel in one step
3. The terminal will show a dashboard with a **public URL** and **Room Code**
4. Open `testing_final.toe` in TouchDesigner

That is it. Players scan the QR code or open the URL on their phones.

---

## How Players Connect

1. Player opens `https://<tunnel-url>?room=<ROOM_CODE>` on their phone
2. They type their name and tap **Connect**
3. They are assigned slot N (1–100) and see the controller UI
4. Inputs are sent over WebSocket → Node.js → OSC → TouchDesigner

---

## Critical Rules — Read Before Touching TD

### NEVER write to a DAT from inside bridge_osc_in's callback

`bridge_osc_in` has **no callbacks set** (`par.callbacks = ''`). This is intentional and must not be changed. TouchDesigner creates a cook dependency loop if any DAT is modified from inside an `oscin` callback — the DAT change marks `oscin` dirty, which fires the callback again, infinitely. See `ARCHITECTURE.md` for the full explanation.

All OSC message processing happens in `osc_processor` (an `executeDAT` that runs `onFrameStart` every frame).

### Never pulse replicator.recreateall manually for performance testing

It destroys and recreates all player clones. Call it only when the real player count (slots 6+) changes. `osc_processor` does this automatically.

### Slots 1–5 are reserved for demo bots

Nemo, Dory, Marlin, Gill, Bubbles live in `user_data` rows 1–5. `bot_motion` animates them. If you want real players to start from slot 1, change `osc_processor`'s player-count check from `range(6, ...)` to `range(1, ...)`.

---

## Key Files and Where Things Live

```
testing_final.toe
└── /project1/
    ├── startup_init          ← Self-healing startup script (runs onStart)
    ├── telemetry_fps_exec    ← Sends FPS to terminal every 30 frames
    ├── telemetry_err_exec    ← Filters errors, sends real ones to terminal
    ├── telemetry_osc_out     ← OSC Out → Node.js port 9001
    └── tdbridge_test/        ← Main network
        ├── bridge_osc_in     ← Passive OSC UDP buffer (port 9000, NO callbacks)
        ├── osc_processor     ← Polls OSC buffer every frame, writes user_data
        ├── bot_motion        ← Animates 5 demo fish every frame
        ├── user_data         ← 101-row state table (header + slot_1…slot_100)
        ├── select_active     ← Filter: only rows where name != ''
        ├── replicator        ← Spawns player_master clones from select_active
        ├── player_master     ← Template COMP for each fish
        ├── item1…itemN       ← Live clones (spawned by replicator)
        ├── all_players       ← CompTOP combining all fish renders
        ├── physics_world     ← Bullet physics solver
        └── wall_top/bottom/left/right ← Arena boundaries
```

---

## How the Data Flows (Step by Step)

```
1. Phone taps ROTATE button
2. app.js sends: {"type":"action1","value":1} over WebSocket
3. relay.ts receives, rate-limits, sends OSC: /slot_6_action1 1.0 → port 9000
4. bridge_osc_in receives the UDP packet → appends a row to its internal buffer
5. osc_processor (next frame, onFrameStart):
   - Reads all rows from bridge_osc_in
   - Parses: slot_id=6, channel=action1, val=1.0
   - Writes: user_data[6, 'action1'] = '1.0'
6. player_master clone (item6) reads user_data[6, 'action1'] via expression
7. Fish rotates visually
```

---

## Common Debugging

### "I see cook dependency loop warnings"

`bridge_osc_in` has had callbacks accidentally re-enabled, OR something is writing to a tracked DAT inside the OSC receive path. Check:
```python
op('/project1/tdbridge_test/bridge_osc_in').par.callbacks.val  # must be ''
```

### "New player joined but no fish appeared"

1. Check `user_data[N, 'name']` — did the name get written?
2. Check `select_active.numRows` — did it increase?
3. If `select_active` increased but no clone appeared, pulse `replicator.par.recreateall`

### "Controls move nothing / joystick sends but fish doesn't respond"

Check `player_master` internals — the clone reads `user_data` via a `selectDAT` expression. Verify `player_master/select_user` is referencing the correct row.

### "Terminal shows NaN fps"

Normal for ~30 frames after startup. If it persists, verify `telemetry_fps_exec` is active and `telemetry_osc_out` is set to `127.0.0.1:9001`.

### "The Cloudflare URL changed"

It changes every time `Start_System.bat` is run. The Room Code also changes. Copy the new URL + Room Code from the terminal dashboard.

---

## What Is NOT Done (Known Missing Features)

| Feature | Status | Notes |
|---|---|---|
| Dynamic UI config from TD | Not implemented | `ui_blueprint` in relay.ts is hardcoded |
| Dynamic background branding from TD | Not implemented | Hardcoded `#1e88e5` blue |
| MediaPipe gesture integration | Not started | Historical request |
| Name tags attached to fish | Not implemented | Old plan in `archive/player_movement_plan.md` |
| Velocity-based movement | Not implemented | Fish teleport on joystick release |

---

## Git History Summary

The major milestones in this repository:

| Commit | What Changed |
|---|---|
| Early commits | Old architecture: TD hosted its own WebServer DAT |
| `651e20f` | Frictionless join + server-driven UI introduced |
| `fe15023` | Ghost player / garbage collection fix |
| `3e47a29` | State before massive cleanup |
| `4b634b2` | Cloudflare IPv4 fix |
| `66ca8da` | Heartbeat OSC sync fix |
| *Current* | Cook loop permanently fixed via passive OSC buffer + frame-poll architecture |
