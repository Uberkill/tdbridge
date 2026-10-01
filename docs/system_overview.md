# TDBridge System Overview: The Non-Technical Guide

If you are a product manager, event producer, or non-technical director, you can think of the entire TDBridge system as a **high-speed digital puppet show**:

- 📱 **The Smartphones** are the puppet's strings (the audience and performer controllers).
- 🧠 **TouchDesigner** is the puppet master and stage (the visual rendering engine).
- ⚡ **WebSockets & OSC** are the invisible high-speed cables connecting the strings to the brain at 60 frames per second.
- 🎛️ **The FOH Master Console** is the director's booth (managing who is on stage, which scene is active, and emergency cues).

---

## 1. How the System Works in Real Life

```mermaid
flowchart TD
    classDef phone fill:#111,stroke:#fff,stroke-width:2px,color:#fff
    classDef relay fill:#222,stroke:#00e5ff,stroke-width:2px,color:#00e5ff
    classDef td fill:#222,stroke:#00ff66,stroke-width:2px,color:#00ff66
    classDef screen fill:#222,stroke:#ffb700,stroke-width:2px,color:#ffb700

    A["📱 Audience & Performer Phones<br/>(Zero App Install / Instant Web QR)"]:::phone
    B["⚡ Node.js Relay Server<br/>(Manages Slots, Security & Throttling)"]:::relay
    C["🧠 TouchDesigner Engine<br/>(Simulation, Physics & Shaders)"]:::td
    D["🖥️ Big Screen Projection / LED Wall<br/>(Live 60 FPS Visuals)"]:::screen
    E["🎛️ FOH Master Operator Console<br/>(Laptop / iPad Show Control)"]:::phone

    A -- 1. Scan QR & Move Joysticks --> B
    E -- 2. Scene Switch & Live Tuning --> B
    B -- 3. High-Speed OSC Packets --> C
    C -- 4. Renders Interactive Scene --> D
    C -. 5. Telemetry & Heartbeat .-> B
    B -. 6. Live Roster & Cook FPS .-> E
```

---

## 2. The Core Components Explained

### 🌐 The Fast Highway: WebSockets & OSC
Normally, websites are built to show you static pages. If you press a button on a normal website, it might take a second to talk to a database.  
In a live show or concert, a 1-second delay feels broken. TDBridge keeps permanent, open network pipes (WebSockets to the relay, and high-frequency UDP OSC to TouchDesigner). Input from your finger reaches the projector screen in **10 to 20 milliseconds**, making it feel like an analog gaming console.

### 📱 The Phone Experience (Zero App Download)
Nobody wants to download an app from the App Store just to interact with a concert or gallery for 10 minutes.
With TDBridge:
1. Attendees point their camera at the on-screen QR code.
2. The phone immediately loads a clean, dark-mode web controller.
3. They pick an avatar color, enter their handle, and immediately control the visuals on stage.
4. If they just want to watch, they can join as a **Spectator** to tap the beat and send reactions without taking up an active performer slot.

### 🎛️ The Dynamic Blueprint Engine (Why It's Magic)
The phone screen does not have hardcoded buttons permanently burned into it. It is a chameleon:
- When the show is running the **Aquarium**, the phone displays a swimming joystick, a *Feed Fish* trigger, a *Change Color* trigger, and swimming speed faders.
- When the director switches to the **Particle Canvas**, the phone instantly morphs into a glowing 2D touch surface with *Brush Size* controls.
- When the director switches to the **DJ Set / Music Scene**, the phone transforms into a 4-channel fader mixing console.
- **You never have to re-code the website.** When TouchDesigner changes scenes, the phones adapt automatically.

### 🛡️ Dual-Code Security: Keeping the Stage Safe
At any live public event, there is a risk of someone trying to mess with the show. TDBridge solves this with two distinct security keys:
1. **Public Room Code (e.g. `HJHX`):** Anyone in the audience can see and use this code. It only gives them control over their own avatar or spectator reactions. They cannot access master cues, kick other people, or crash the server.
2. **Private Master Key (`OP-XXXXXX`) or 4-Digit PIN (`1234`):** Strictly for the VJ and stage crew. It unlocks the Front-of-House Console to switch scenes, adjust simulation speeds, or disconnect disruptive users.

---

## 3. What Happens When Something Breaks? (Self-Healing)
Live events are unpredictable. What happens if someone unplugs a cable, renames a scene folder, or a phone loses Wi-Fi?
- **Ghost-Free Disconnects:** If a user walks out of the venue or closes their phone, the system cleans up their slot within seconds, removes their avatar, and frees the slot for someone else.
- **Network Self-Healing:** If an artist adds a new visual scene or renames a folder inside TouchDesigner, clicking **`[Audit & Self-Heal Network]`** automatically reconnects all video wires and data pipelines without taking the show offline.
- **Failover Protection:** If an active scene is accidentally deleted during performance, TDBridge catches the error and instantly falls back to a safe screen (like the QR Banner), preventing the audience from ever seeing a black screen.
