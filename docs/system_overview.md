# TDBridge System Overview

As a product designer, you can think of this entire system as a **digital puppet show**. 
- The **Mobile Phone** is the puppet's strings (the controller).
- **TouchDesigner** is the puppet master (the brain).
- **WebSockets** are the invisible wires connecting the strings to the brain.

Here is the high-level breakdown of how the data flows in milliseconds.

## 1. The Architecture (Visualized)

```mermaid
flowchart TD
    %% Define Styles
    classDef phone fill:#1a73e8,stroke:#000,stroke-width:2px,color:#fff
    classDef cloud fill:#fbbc05,stroke:#000,stroke-width:2px,color:#000
    classDef td fill:#34a853,stroke:#000,stroke-width:2px,color:#fff
    classDef db fill:#ea4335,stroke:#000,stroke-width:2px,color:#fff

    %% Nodes
    A[📱 Mobile Phone (GitHub Pages)]:::phone
    B((☁️ Cloudflare Tunnel)):::cloud
    C[🧠 TouchDesigner Server]:::td
    D[(💾 ui_config Spreadsheet)]:::db
    E[(💾 user_data Spreadsheet)]:::db
    F[✨ Visual Effects Output]:::td

    %% Connections
    A -- 1. Joins the Room --> B
    B -- Passes connection --> C
    D -. 2. Generates Blueprint .-> C
    C -- 3. Sends Blueprint back --> A
    A -- 4. User moves joystick --> B
    B -- Passes Joystick Data --> C
    C -- 5. Updates Player Data --> E
    E -- 6. Drives Graphics --> F
```

---

## 2. The Components, Explained

### 🌐 The Invisible Wire: WebSockets
Normally, when you visit a website, you click a link, wait 2 seconds, and a new page loads. That is too slow for gaming or live visuals. 
**WebSockets** are different. When your phone connects, it leaves a permanent "tube" open between your phone and TouchDesigner. We can shove data down this tube 30 to 60 times a second instantly, with zero loading screens.

### 📱 The Frontend (The Phone)
The code hosted on GitHub Pages is just an empty shell. By itself, it has no buttons and no idea what it is supposed to control. It only has one job: **Wait for instructions.**
When a user scans the QR code and types in the 4-letter room code, the phone reaches out across the internet and connects to TouchDesigner via the Cloudflare Tunnel.

### 🧠 The Backend (TouchDesigner)
TouchDesigner is the absolute master of this system. When it sees a new phone connect, it does two things:
1. **The Handshake:** It looks at the `ui_config` spreadsheet you built in TouchDesigner, translates it into a digital blueprint, and shoots it down the WebSocket tube to the phone.
2. **The Transformation:** The phone receives the blueprint and *instantly* draws the giant buttons, sliders, and joysticks on the screen. 

### 🎛️ The Modularity (Why this is magic for you)
Because the phone is just an empty shell taking orders, **you never have to code the website again.**
If you want to add a new "Flashbang" button for a live show:
1. You open the `ui_config` spreadsheet in TouchDesigner.
2. You type `button` in one column, `Flashbang` in the next, and pick a hex color.
3. You save it.
That's it. The next time a user joins, TouchDesigner tells their phone to draw a Flashbang button.

### 💥 The Output (Driving the Visuals)
When the user taps that new Flashbang button, the phone sends a tiny message down the WebSocket tube: `"I pressed Flashbang"`.
TouchDesigner instantly writes a `1` next to that user's name in the `user_data` spreadsheet. 
Because TouchDesigner is built for visuals, you simply take that `1` from the spreadsheet, wire it into a lighting effect or a particle explosion, and the visual happens on the big screen instantly.
