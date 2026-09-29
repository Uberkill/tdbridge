# Template 01: Interactive Aquarium

This template showcases how an interactive multi-agent simulation connects to the standardized outputs of `TDBridge`.

## Overview
- **Visuals**: Autonomous swimming fish bots, real-time player avatars, responsive food feeding system, atmospheric bubbles, and water lighting effects.
- **Contract Connection**:
  - `op('TDBridge/out_players_dat')`: Feeds player slot IDs, names, and activity flags into the fish replicator.
  - `op('TDBridge/out_players_chop')`:
    - `tx`, `ty`: Player fish coordinates in normalized `[-1.0, 1.0]` screen space.
    - `b1` (`action1`): Trigger 360-degree spin animation.
    - `b2` (`action2`): Cycle player fish color palette.
    - `b3` (`action3`): Drop food pellet at current fish location.
    - `s1` (`slider1`): Adjust swimming cruise speed.
    - `s2` (`slider2`): Adjust individual fish scale (0.35 to 0.95).
- **Environment Controls**:
  - `Numbots`: Number of background autonomous choir fishes (0 to 5).
  - `Botscalemult` / `Playerscalemult`: Master size multipliers.
  - `Scarefishes`: Trigger startle reaction pulse.
