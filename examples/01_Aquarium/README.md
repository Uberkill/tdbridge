# Example 01: Interactive Multi-Agent Aquarium

Multi-agent biological simulation demonstrating how live audience players interact with autonomous agents inside TouchDesigner.

---

## Overview & Visual Features

- **Autonomous Agent Choir**: Slots 1–5 are occupied by autonomous fish that swim using noise-driven vector steering, flocking, and ambient wall avoidance.
- **Audience Player Fish**: Connecting performers (Slots 6–100) control fish avatars with real-time vector swimming, color palettes, and rotation.
- **Interactive Food Feeding**: Performers drop food pellets (`b3` / `action3`), which attract nearby fish using proximity steering forces.
- **Atmospheric Visuals**: Caustics, rising bubbles, depth-of-field water shading, and lighting ripples.

---

## Pipeline & Node Hookup

```text
┌──────────────────────────────────────────────────────────────────┐
│                   /project1/1_Fishtank COMP                      │
│                                                                  │
│  [ select_bridge ] (CHOP) ───► Ingests 100 player channels       │
│         │                                                        │
│         ├── tx, ty ──────────► Position & Velocity Steering      │
│         ├── b1 (action1) ────► 360° Spin Animation Trigger       │
│         ├── b2 (action2) ────► Color Palette Step Trigger        │
│         ├── b3 (action3) ────► Food Pellet Spawn & Target Force  │
│         ├── s1 (speed) ──────► Swim Velocity Multiplier          │
│         ├── s2 (size) ───────► Fish Geometry Scale               │
│         └── r, g, b ─────────► Instance Color Swatch             │
│                                                                  │
│  [ replicator_fish ] ────────► Replicates fish geometry per user │
│  [ out1 ] (TOP) ─────────────► Wires to /project1/switch_preview │
└──────────────────────────────────────────────────────────────────┘
```

---

## FOH Master Operator Controls

When the Aquarium scene is active, the Front-of-House Master Console exposes real-time environment parameters:
- `SCARE FISH`: Pulses a startle reaction scattering fish toward the perimeter.
- `DROP FOOD`: Spawns food pellets at the center of the aquarium.
- `BOT CHOIR COUNT (0–5)`: Sets the number of active background AI fish.
- `SWIM VELOCITY`: Global speed multiplier for fish motion.
- `BOT SCALE MULTIPLIER`: Fish geometry scale multiplier.

---

## Customization Guide

1. **Change the 3D Fish Model**: Open `/project1/1_Fishtank/player_master` and replace the geometry SOP with your own FBX/OBJ model.
2. **Adjust Water Lighting**: Modify `/project1/1_Fishtank/water_lighting` and `/project1/1_Fishtank/caustics_fx`.
3. **Change Behavior**: Modify steering weights in `/project1/1_Fishtank/fish_behavior_exec`.
