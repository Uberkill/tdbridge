# TDBridge System Overview: The Non-Technical Guide

If you are a product manager, event producer, or non-technical director, you can think of the entire TDBridge system as a **high-speed digital puppet show**:

- **The Smartphones**: The puppet's strings (the audience and performer controllers).
- **TouchDesigner**: The puppet master and stage (the visual rendering engine).
- **WebSockets & OSC**: The invisible high-speed cables connecting the strings to the brain at 60 frames per second.
- **The FOH Master Console**: The director's booth (managing who is on stage, which scene is active, and emergency cues).

---

## 1. How the System Works in Real Life

```mermaid
flowchart TD
    classDef phone fill:#111,stroke:#fff,stroke-width:2px,color:#fff
    classDef relay fill:#222,stroke:#00e5ff,stroke-width:2px,color:#00e5ff
    classDef td fill:#222,stroke:#00ff66,stroke-width:2px,color:#00ff66
    classDef screen fill:#222,stroke:#ffb700,stroke-width:2px,color:#ffb700

    A["Audience & Performer Phones<br/>(Zero App Install / Instant Web QR)"]:::phone
    B["Node.js Relay Server<br/>(Manages Slots, Security & Throttling)"]:::relay
    C["TouchDesigner Engine<br/>(Simulation, Physics & Shaders)"]:::td
    D["Big Screen Projection / LED Wall<br/>(Live 60 FPS Visuals)"]:::screen
    E["FOH Master Operator Console<br/>(Laptop / iPad Show Control)"]:::phone

    A -- 1. Scan QR & Move Joysticks --> B
    E -- 2. Scene Switch & Live Tuning --> B
    B -- 3. High-Speed OSC Packets --> C
    C -- 4. Renders Interactive Scene --> D
    C -. 5. Telemetry & Heartbeat .-> B
    B -. 6. Live Roster & Cook FPS .-> E
```

---

## 2. Core Components Explained

### High-Speed Network Ingress: WebSockets & OSC
Normally, websites are built to load static pages. If you press a button on a standard website, it often takes hundreds of milliseconds to communicate with a database.  
In a live show or concert, even a 100-millisecond delay feels sluggish. TDBridge keeps permanent, open network pipes (WebSockets to the relay, and high-frequency UDP OSC to TouchDesigner). Input from an attendee's thumb reaches the projector screen in **10 to 20 milliseconds**, delivering the responsiveness of a dedicated analog hardware controller.

### The Smartphone Experience (Zero App Download)
No attendee wants to download a native app from the App Store just to interact with a concert or art gallery for 10 minutes.
With TDBridge:
1. Attendees point their camera at the on-screen QR code.
2. The phone immediately loads a clean, dark-mode web controller.
3. They enter their callsign handle, choose an avatar color from the palette, and click **`[ ENTER STAGE -> ]`**.
4. They immediately control their avatar on stage with 60Hz vector joystick response.

### Dynamic Event Branding
The event title displayed on attendee screens is never hardcoded. Event producers or visual artists set the show title directly inside TouchDesigner via the **`Sessionname`** parameter (e.g. `MAIN STAGE` or `TOAD LIVE`). This title immediately updates the attendee welcome screen and the stage projection banner with zero server restarts.

### Universal Multi-Device Scaling
Whether an attendee joins on a compact smartphone, an iPhone 16 Pro (19.5:9), an Android flagship (~20:9), or an iPad (4:3), the user interface dynamically adapts. On Front-of-House 1080p and 4K displays, the cards and control surfaces scale up proportionally into expansive, high-contrast command stations rather than appearing as tiny mobile stamps.

### The Dynamic Blueprint Engine
The phone screen does not have hardcoded buttons permanently burned into it. It morphs dynamically:
- When the show is running the **Aquarium**, the phone displays a vector joystick, a *Feed Fish* trigger, a *Change Color* trigger, and swimming speed faders.
- When the director switches to the **Particle Canvas**, the phone instantly morphs into a glowing 2D touch surface with *Brush Size* controls.
- When the director switches to a **DJ Set / Music Scene**, the phone transforms into a 4-channel fader mixing console.
- **You never have to re-code the website.** When TouchDesigner changes scenes, the phones adapt automatically.

### Dual-Code Security: Keeping the Stage Safe
At any live public event, there is a risk of someone attempting to disrupt the show. TDBridge enforces two distinct security keys:
1. **Public Room Code (e.g. `HJHX`):** Displayed publicly on stage. It only gives attendees control over their own avatar (slots 6–100). They cannot access master cues, kick other people, or crash the server.
2. **Private Master Key (`OP-XXXXXX`) or 4-Digit PIN (`1234`):** Strictly for the VJ and stage crew. It unlocks the Front-of-House Console to switch scenes, adjust simulation speeds, or disconnect disruptive users. Access is covertly available via the bottom-right `OP-ACCESS` micro-trigger or `Ctrl+Shift+O`.

---

## 3. What Happens When Something Breaks? (Self-Healing)

Live events are unpredictable. What happens if someone unplugs a cable, renames a scene folder, or a phone loses Wi-Fi?
- **Ghost-Free Disconnects:** If a user walks out of the venue or closes their phone, the system cleans up their slot within seconds, removes their avatar, and frees the slot for someone else.
- **Network Self-Healing:** If an artist adds a new visual scene or renames a folder inside TouchDesigner, clicking **`[Audit & Self-Heal Network]`** automatically reconnects all video wires and data pipelines without taking the show offline.
- **Failover Protection:** If an active scene is accidentally deleted during performance, TDBridge catches the error and instantly falls back to a safe screen (like the QR Banner), preventing the audience from ever seeing a black screen.
- **Telemetry Stability:** TouchDesigner sends a 1-second heartbeat to ensure the relay server has current state, while server-side value-change guards prevent terminal spam and diagnostic buffer thrashing.
