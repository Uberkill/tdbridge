# Modular Multi-User TouchDesigner Installation

This repository contains the boilerplate for a production-ready, zero-latency multi-user controller for TouchDesigner.

## Architecture
- **Frontend:** Static HTML/JS (designed for GitHub Pages).
- **Relay Server:** Node.js WebSocket to UDP OSC Bridge (runs locally on TouchDesigner PC).
- **Tunnel:** Cloudflare Tunnel (`cloudflared`) to expose the local relay to the public securely.

## 1. Local Testing
1. In this folder, run `npm install`.
2. Run the relay server: `node relay.js`.
3. Open `public/index.html` in your browser. (You can also run a simple local web server using `npx serve public`).
4. Click "Tap to Join". You should see "Connected: Player 1" and the virtual joystick.
5. Watch the Node.js console log. It will show the player connecting.

## 2. TouchDesigner Setup (Zero-Python, Zero-Lag)
Because of our hardcore Red Team pre-mortem, we are using a **pure CHOP** pipeline in TouchDesigner to guarantee 60fps.

1. Open TouchDesigner.
2. Add an **OSC In CHOP**.
3. Set the **Network Port** to **9000**.
4. When you move the joystick in your browser, you will immediately see channels appear like `slot_1_x` and `slot_1_y`.
5. **Smoothing:** Feed the OSC In CHOP into a **Lag CHOP** to perfectly smooth the 30Hz web data into 60Hz visuals.
6. **Instancing:** Create a Geometry COMP. Set Instancing to ON. Use a Pattern CHOP or Table DAT to define 15 fixed instance points. Use Math CHOPs or select CHOPs to route `slot_*_x` to Translate X.
7. **Ghost Cleanup:** Feed the X/Y channels into a **Slope CHOP** and a **Logic CHOP** to detect when a user stops moving for 2 seconds, and use that to fade out their scale. (Alternatively, the Node.js relay will hard-reset them to 0,0 after 15 seconds of disconnect).

## 3. Production Deployment (GitHub Pages + Cloudflare)
1. Push the contents of the `public` folder to a GitHub repository and enable GitHub Pages.
2. Install [Cloudflare Tunnel (`cloudflared`)](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) on your TouchDesigner PC.
3. Authenticate `cloudflared` and create a tunnel routing to port 8080:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
4. Copy the generated HTTPS URL (or your custom domain).
5. Open `public/app.js` and change the `host` variable in `connectWS()` to match your tunnel URL (make sure it starts with `wss://`).
6. Commit and push the changes to GitHub.
7. Have users scan a QR code pointing to your GitHub Pages URL!
