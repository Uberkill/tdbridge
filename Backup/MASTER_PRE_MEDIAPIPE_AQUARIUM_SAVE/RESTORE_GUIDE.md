# Master Fallback: Pre-MediaPipe Aquarium State

This directory is an **immutable snapshot** of the TDBridge project before the MediaPipe modular architecture transition.

- **Timestamp of Snapshot**: September 29, 2026, 11:28 PM
- **Git Checkpoint Commit**: `00ba705` (`checkpoint: working aquarium state before mediapipe modularization`)

## What is in this snapshot?
1. `testing_final.toe`: The complete, working aquarium fish simulation with:
   - 5 autonomous fish bots (Nemo, Dory, Marlin, Gill, Bubbles) with distinct scales and organic swimming
   - Environment controls (bot counts, speeds, scales, atmospheric bubbles, lighting caustics)
   - Interactive feeding system (`action3` drops food pellets, fish swim to eat)
   - Replicator slot mapping (slots 1-5 bots, slots 6-100 human players)
   - Movement persistence (zero snap-back on joystick release)
   - 360-degree rotation animation and palette color cycling
2. `src/`, `dist/`, `public/`: The working Node.js relay server and mobile web interface before profile switching.
3. `Start_System.bat`: The production launcher.

## How to restore this version:
If you ever want to completely revert back to this point:
1. Copy `testing_final.toe` from this directory into the root `TDBridge/` directory.
2. Copy `src/`, `dist/`, and `public/` into the root `TDBridge/` directory.
3. Launch `Start_System.bat`.
Everything will immediately run at this exact working state.
