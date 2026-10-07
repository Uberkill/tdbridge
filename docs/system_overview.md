# TDBridge System Overview

High-level conceptual breakdown of how mobile phones, the relay server, and TouchDesigner interact in real time.

---

## 1. Data Flow Architecture

```mermaid
flowchart TD
    classDef phone fill:#1a73e8,stroke:#000,stroke-width:2px,color:#fff
    classDef cloud fill:#fbbc05,stroke:#000,stroke-width:2px,color:#000
    classDef td fill:#34a853,stroke:#000,stroke-width:2px,color:#fff
    classDef db fill:#ea4335,stroke:#000,stroke-width:2px,color:#fff

    A[Mobile Phone / Browser]:::phone
    B((Cloudflare Tunnel / LAN)):::cloud
    C[Relay Server & TouchDesigner]:::td
    D[(ui_blueprint Config)]:::db
    E[(players_data Table)]:::db
    F[Visual Effects Output]:::td

    A -- 1. Joins room --> B
    B -- Passes connection --> C
    D -. 2. Generates blueprint .-> C
    C -- 3. Sends blueprint --> A
    A -- 4. User moves joystick/triggers --> B
    B -- Passes input data --> C
    C -- 5. Updates player data --> E
    E -- 6. Drives generative visuals --> F
```

---

## 2. Core Components

### WebSockets Transport
Standard HTTP request-response cycles take hundreds of milliseconds—far too slow for interactive performance visuals. WebSockets maintain a persistent full-duplex TCP socket between the mobile browser and the relay, allowing inputs to transmit at 60Hz with single-digit millisecond latency.

### The Mobile Client
The client frontend is a responsive web application that requires zero app store installation. It acts as a dynamic surface:
1. Connects to the relay using the 4-character room code.
2. Receives the active UI blueprint from the server.
3. Renders the appropriate controls (joysticks, buttons, continuous faders).

### TouchDesigner Engine
TouchDesigner acts as the master visual host:
1. **Handshake**: Transmits the active scene blueprint so mobile interfaces match the visual requirements.
2. **Execution**: Incoming OSC channel values populate the pre-allocated `players_data` table and `out_players_chop` channels.
3. **Rendering**: Visual operators wire directly into player channels to drive particle positions, instanced geometries, and color modulations.

### Modular Control Blueprints
Because interfaces are driven by blueprints, changing controls does not require redeploying the web client:
1. TouchDesigner or the FOH console switches scenes or updates `ui_blueprint`.
2. All connected phones dynamically morph to the new control layout.
3. Player input continues flowing into TouchDesigner seamlessly.
