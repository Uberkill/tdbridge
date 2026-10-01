# Example 01: Interactive Multi-Agent Aquarium

A complete multi-agent biological simulation demonstrating how 100 live audience players interact with autonomous AI agents inside TouchDesigner.

---

## 🐟 Overview & Visual Features

- **Autonomous AI Fish Choir:** Slots 1–5 are occupied by autonomous fish that swim smoothly using noise-driven vector steering, flocking, and ambient wall avoidance.
- **Audience Player Fish:** Connecting performers (Slots 6–100) control customized fish avatars with real-time vector swimming, color palettes, and rotation.
- **Interactive Food Feeding System:** Performers drop food pellets (`b3` / `action3`), which attract nearby fish using proximity steering forces.
- **Atmospheric Visuals:** Dynamic caustics, rising air bubbles, soft depth-of-field water shading, and lighting ripples.

---

## 🔌 Pipeline & Node Hookup

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

## 🎛️ FOH Master Operator Controls

When the Aquarium is active, the Front-of-House Master Console exposes real-time environment parameters:
- `[01 // SCARE FISHES]`: Pulses a startle reaction that scatters all fish toward the perimeter.
- `[02 // DROP FOOD]`: Spawns food pellets at the center of the aquarium.
- `BOT CHOIR COUNT (0–5)`: Sets the number of active background AI fish.
- `SWIM VELOCITY`: Global speed multiplier for fish motion.
- `BOT SCALE MULTIPLIER`: Fish geometry scale multiplier.

---

## 🎨 How to Customize This Scene

1. **Change the 3D Fish Model:** Open `/project1/1_Fishtank/player_master` and replace the geometry SOP with your own FBX/OBJ model.
2. **Adjust Water Lighting:** Tweak `/project1/1_Fishtank/water_lighting` and `/project1/1_Fishtank/caustics_fx`.
3. **Change Behavior:** Modify steering weights in `/project1/1_Fishtank/fish_behavior_exec`.
