# Template 02: Particle Canvas (Generative 3D Ribbons)

This template demonstrates GPU instanced geometry directly driven by `TDBridge/out_players_chop`.

## Overview
- **Visuals**: Real-time glowing 3D particle nodes with infinite feedback phosphor decay trails.
- **Contract Connection**:
  - `op('TDBridge/out_players_chop')`:
    - `active`: Instancing scale channel. Only active players (active > 0.5) appear on screen.
    - `tx`, `ty`: Direct 3D instance translation coordinates.
    - `s1`: Can be mapped to particle radius, trail decay rate, or particle velocity.
    - `b1` / `b2`: Flash triggers, color shifts, or impulse forces.
- **Components Included**:
  - `Particle_Canvas.tox`: Pre-configured Base COMP with `selectCHOP`, `geometryCOMP`, `constantMAT`, `renderTOP`, and `feedbackTOP`.
  - Drop `Particle_Canvas.tox` into any TouchDesigner project where `TDBridge.tox` is running to immediately get a working generative multi-user visual.
