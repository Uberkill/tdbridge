# Example 02: Generative 3D Particle Canvas

GPU-instanced generative visual system demonstrating how multi-touch mobile drawing surfaces drive real-time ribbons, motion feedback, and phosphorescent trails in TouchDesigner.

---

## Overview & Visual Features

- **GPU-Instanced Geometry**: All 100 player ribbons are evaluated concurrently on the GPU without CPU node creation overhead.
- **Continuous Feedback Trails**: Uses multi-pass feedback loops (`feedbackTOP` -> `levelTOP` -> `compositeTOP`) to generate laser-like trailing curves.
- **Multi-Touch Reactive Painting**: When performers draw on their touchscreens, their coordinate vectors (`tx`, `ty`), brush sizes (`s1`), and palette hues (`r`, `g`, `b`) project directly into 3D camera space.
- **Autonomous Ambient Motion**: Background guide particles (Slots 1–5) keep the visual energetic even when zero audience phones are connected.

---

## Pipeline & Node Hookup

```text
┌──────────────────────────────────────────────────────────────────┐
│               /project1/2_particle_canvas COMP                   │
│                                                                  │
│  [ select_bridge ] (CHOP) ───► Ingests 100 player channels       │
│         │                                                        │
│         ├── active ──────────► Instance Scale (0 = hide, 1 = show)│
│         ├── tx, ty ──────────► 3D Position Coordinates (X, Y)    │
│         ├── s1 (brush_size) ─► Instance Scale Multiplier         │
│         ├── r, g, b ─────────► Instance RGB Color Channels       │
│         ├── b1 (touch_active)► Paint Stroke Enable               │
│         └── b2 (clear_pulse) ► Immediate Trail Flush Trigger     │
│                                                                  │
│  [ geo1 ] (Geometry COMP) ───► GPU Instancing enabled            │
│  [ cam1 ] (Camera COMP) ─────► Front-framed projection view      │
│  [ feedback1 ] ──────────────► Phosphor decay feedback loop      │
│  [ out1 ] (TOP) ─────────────► Wires to /project1/switch_preview │
└──────────────────────────────────────────────────────────────────┘
```

---

## FOH Master Operator Controls

When the Particle Canvas is active, the Front-of-House Master Console exposes real-time environment parameters:
- `BURST PARTICLES`: Pulses a full reset on the feedback loop, clearing the canvas.
- `PALETTE SHIFT`: Cycles the master color hue offset across all particles.
- `TRAIL PERSISTENCE (50% – 99%)`: Controls the feedback decay rate (`level1.par.opacity`), from crisp sparks to endless glowing fog.
- `FIELD TURBULENCE (0.1x – 2.0x)`: Modulates particle velocity and curl noise speed.

---

## Customization Guide

1. **Change Particle Shape**: Replace `circleSOP` or `boxSOP` inside `/project1/2_particle_canvas/geo1` with custom 3D geometry or sprites.
2. **Add Glow & Post-Processing**: Insert a `bloomTOP` or `blurTOP` before `out1`.
3. **Change Camera Angles**: Animate `cam1` coordinates for 3D orbital perspectives.
