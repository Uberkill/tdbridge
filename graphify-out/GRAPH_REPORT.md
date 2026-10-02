# Graph Report - C:\Users\oob\.gemini\antigravity\scratch\TDBridge  (2026-10-02)

## Corpus Check
- 125 files · ~267,371 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 680 nodes · 783 edges · 84 communities (66 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Client UI State & DOM Architecture
- Compiled Client Bundle Elements
- Hardware Control Profiles & Schemas
- Package Manifest & System Dependencies
- Legacy Test Runners & Archives
- Relay Server Core & Network Dispatch
- Compiled Client WebSocket Networking
- Client WebSocket Handlers & RTT Loop
- Touch Joystick & Pointer Input Engine
- Archived Relay & Debug Modules
- Compiled Blueprint Renderer & Haptics
- Dynamic Blueprint Engine & Sliders
- E2E Stress & Edge Case Tests
- TypeScript Compiler Configuration
- TouchDesigner Patching Automation Tools
- Test Module 15
- Test Module 16
- Test Module 17
- TouchDesigner Patch 18
- Test Module 19
- Test Module 20
- Test Module 21
- Test Module 22
- Test Module 23
- Test Module 24
- Test Module 25
- Test Module 26
- Test Module 27
- Test Module 28
- Test Module 29
- Test Module 30
- Test Module 31
- Test Module 32
- Test Module 33
- Build Tool 34
- Build Tool 35
- Test Module 36
- Test Module 37
- Build Tool 38
- Test Module 39
- Test Module 40
- Test Module 41
- Build Tool 42
- Test Module 43
- Test Module 44
- Test Module 45
- Test Module 46
- Build Tool 47
- Subsystem 49
- Test Module 50
- Test Module 51
- Test Module 52
- Client Subsystem 53
- Client Subsystem 54
- Subsystem 66
- Subsystem 70
- Subsystem 71
- Test Module 72
- Test Module 73
- Client Subsystem 75
- Client Subsystem 76

## God Nodes (most connected - your core abstractions)
1. `attachWebSocketHandlers()` - 15 edges
2. `attachWebSocketHandlers()` - 15 edges
3. `scripts` - 9 edges
4. `runTests()` - 8 edges
5. `main()` - 8 edges
6. `runRelayTests()` - 7 edges
7. `addLog()` - 7 edges
8. `main()` - 7 edges
9. `compilerOptions` - 7 edges
10. `runTDTests()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `attachWebSocketHandlers()` --calls--> `renderBlueprint()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 6 → community 10_
- `attachWebSocketHandlers()` --calls--> `renderBlueprint()`  [EXTRACTED]
  src/client/app.ts → src/client/app.ts  _Bridges community 7 → community 11_

## Import Cycles
- None detected.

## Communities (84 total, 18 thin omitted)

### Community 0 - "Client UI State & DOM Architecture"
Cohesion: 0.02
Nodes (79): actionButtons, audienceBpmBtn, bpmNumber, codeBoxes, ControlItem, cuePurgeBtn, cueResetBtn, gateTelemetry (+71 more)

### Community 1 - "Compiled Client Bundle Elements"
Cohesion: 0.02
Nodes (78): actionButtons, audienceBpmBtn, bpmNumber, codeBoxes, cuePurgeBtn, cueResetBtn, errorMsg, exitBtn (+70 more)

### Community 2 - "Hardware Control Profiles & Schemas"
Cohesion: 0.06
Nodes (45): BUILTIN_PROFILES, ControlItem, ControllerProfile, sanitizeBlueprint(), audienceSockets, audienceTapCounters, binPath, broadcastProfileChange() (+37 more)

### Community 3 - "Package Manifest & System Dependencies"
Cohesion: 0.06
Nodes (34): author, dependencies, express, osc, qrcode-terminal, ws, description, devDependencies (+26 more)

### Community 4 - "Legacy Test Runners & Archives"
Cohesion: 0.12
Nodes (27): ARGS, dgram, fs, http, http_get(), isPortOpen(), log(), net (+19 more)

### Community 5 - "Relay Server Core & Network Dispatch"
Cohesion: 0.09
Nodes (26): child_process_1, express_1, fs_1, http_1, ACTIVE_ROOM_CODE, addLog(), app, cf (+18 more)

### Community 6 - "Compiled Client WebSocket Networking"
Cohesion: 0.14
Nodes (16): attachWebSocketHandlers(), connectWS(), disconnectSession(), executeMasterAuth(), flushInputs(), handlePong(), handleRosterUpdate(), hydrateMasterEnvSliders() (+8 more)

### Community 7 - "Client WebSocket Handlers & RTT Loop"
Cohesion: 0.14
Nodes (16): attachWebSocketHandlers(), disconnectSession(), executeMasterAuth(), flushInputs(), handlePong(), handleRosterUpdate(), hydrateMasterEnvSliders(), sendHostCommand() (+8 more)

### Community 8 - "Touch Joystick & Pointer Input Engine"
Cohesion: 0.14
Nodes (14): buildDynamicUI(), dynamicControls, joystickZone, connectWS(), errorMsg, exitBtn, gate, joinBtn (+6 more)

### Community 9 - "Archived Relay & Debug Modules"
Cohesion: 0.22
Nodes (9): ACTIVE_ROOM_CODE, freeSlot(), osc_1, sendOSC_Float(), sendOSC_String(), slots, udpPort, ws_1 (+1 more)

### Community 10 - "Compiled Blueprint Renderer & Haptics"
Cohesion: 0.22
Nodes (10): bindSliderModule(), renderBlueprint(), renderDynamicSceneRack(), resetAllControlInputs(), safeHaptic(), sendControl(), sendEnv(), sendThrottledEnv() (+2 more)

### Community 11 - "Dynamic Blueprint Engine & Sliders"
Cohesion: 0.22
Nodes (10): bindSliderModule(), renderBlueprint(), renderDynamicSceneRack(), resetAllControlInputs(), safeHaptic(), sendControl(), sendEnv(), sendThrottledEnv() (+2 more)

### Community 12 - "E2E Stress & Edge Case Tests"
Cohesion: 0.38
Nodes (9): getRoomCode(), http, main(), sleep(), testConcurrentPlayers(), testCorruptedAndExtremePayloads(), testImmediateRejoin(), testInvalidRoomCode() (+1 more)

### Community 13 - "TypeScript Compiler Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, lib, module, moduleResolution, skipLibCheck, target, exclude (+1 more)

### Community 14 - "TouchDesigner Patching Automation Tools"
Cohesion: 0.42
Nodes (8): main(), patch_cparm(), patch_osc_processor(), patch_param_exec(), patch_parm(), patch_readme(), patch_telemetry_exec(), sync_tox()

### Community 15 - "Test Module 15"
Cohesion: 0.29
Nodes (5): http, log(), net, results, runTDTests()

### Community 16 - "Test Module 16"
Cohesion: 0.39
Nodes (7): dgram, getTelemetry(), http, parseOscString(), runTest(), waitForTelemetry(), WebSocket

### Community 17 - "Test Module 17"
Cohesion: 0.32
Nodes (7): CWD, hr(), http, main(), path, probeHttp(), { spawnSync }

### Community 18 - "TouchDesigner Patch 18"
Cohesion: 0.46
Nodes (7): main(), patch_cparm(), patch_param_exec(), patch_parm(), patch_qr_display(), patch_telemetry_exec(), sync_to_tox()

### Community 19 - "Test Module 19"
Cohesion: 0.43
Nodes (6): connectPlayer(), getRoomCode(), http, main(), sleep(), WebSocket

### Community 20 - "Test Module 20"
Cohesion: 0.43
Nodes (6): get(), http, post(), run(), sleep(), WebSocket

### Community 21 - "Test Module 21"
Cohesion: 0.43
Nodes (6): http, httpGet(), runVerification(), sleep(), tdExec(), WebSocket

### Community 22 - "Test Module 22"
Cohesion: 0.38
Nodes (6): dgram, fetchTelemetry(), http, parseOscString(), run(), WebSocket

### Community 23 - "Test Module 23"
Cohesion: 0.33
Nodes (6): { chromium }, fetchTelemetry(), http, path, run(), VIEWPORTS

### Community 24 - "Test Module 24"
Cohesion: 0.40
Nodes (5): { chromium }, getRoomCode(), http, path, runLiveE2ETest()

### Community 25 - "Test Module 25"
Cohesion: 0.47
Nodes (5): getRoomCode(), http, main(), sleep(), WebSocket

### Community 26 - "Test Module 26"
Cohesion: 0.47
Nodes (5): getRoomCode(), http, main(), sleep(), WebSocket

### Community 27 - "Test Module 27"
Cohesion: 0.47
Nodes (5): get(), http, run(), sleep(), WebSocket

### Community 28 - "Test Module 28"
Cohesion: 0.47
Nodes (5): getRoomCode(), http, runScenario(), sleep(), WebSocket

### Community 29 - "Test Module 29"
Cohesion: 0.47
Nodes (5): getHealth(), http, runBattery(), tdExec(), WebSocket

### Community 30 - "Test Module 30"
Cohesion: 0.47
Nodes (5): getRoomCode(), http, run(), sleep(), WebSocket

### Community 31 - "Test Module 31"
Cohesion: 0.33
Nodes (4): fs, http, path, { spawnSync }

### Community 32 - "Test Module 32"
Cohesion: 0.47
Nodes (5): fetchTelemetry(), http, runMasterSecurityTests(), sleep(), WebSocket

### Community 33 - "Test Module 33"
Cohesion: 0.40
Nodes (5): capture(), { chromium }, fetchTelemetry(), http, path

### Community 34 - "Build Tool 34"
Cohesion: 0.47
Nodes (5): getRoomCode(), http, run(), sleep(), WebSocket

### Community 35 - "Build Tool 35"
Cohesion: 0.47
Nodes (5): getRoom(), http, run(), sleep(), WebSocket

### Community 36 - "Test Module 36"
Cohesion: 0.40
Nodes (4): child_process_1, dgram, path, playwright_1

### Community 37 - "Test Module 37"
Cohesion: 0.50
Nodes (4): { chromium }, fetchTelemetry(), http, run()

### Community 38 - "Build Tool 38"
Cohesion: 0.40
Nodes (3): files, fs, path

### Community 41 - "Test Module 41"
Cohesion: 0.67
Nodes (3): assert, runTests(), WebSocket

### Community 46 - "Test Module 46"
Cohesion: 0.50
Nodes (3): files, fs, path

### Community 53 - "Client Subsystem 53"
Cohesion: 0.67
Nodes (3): handleJoyMove(), resizeCanvas(), updateJoyBounds()

### Community 54 - "Client Subsystem 54"
Cohesion: 0.67
Nodes (3): handleJoyMove(), resizeCanvas(), updateJoyBounds()

## Knowledge Gaps
- **359 isolated node(s):** `ws_1`, `osc_1`, `wss`, `ACTIVE_ROOM_CODE`, `udpPort` (+354 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `PERMANENT HARDENING SCRIPT - testing_final STABILIZER Run this once when the pro`, `ws_1`, `osc_1` to the rest of the system?**
  _363 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Client UI State & DOM Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.023809523809523808 - nodes in this community are weakly interconnected._
- **Should `Compiled Client Bundle Elements` be split into smaller, more focused modules?**
  _Cohesion score 0.024096385542168676 - nodes in this community are weakly interconnected._
- **Should `Hardware Control Profiles & Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.05580693815987934 - nodes in this community are weakly interconnected._
- **Should `Package Manifest & System Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `Legacy Test Runners & Archives` be split into smaller, more focused modules?**
  _Cohesion score 0.12169312169312169 - nodes in this community are weakly interconnected._
- **Should `Relay Server Core & Network Dispatch` be split into smaller, more focused modules?**
  _Cohesion score 0.08994708994708994 - nodes in this community are weakly interconnected._