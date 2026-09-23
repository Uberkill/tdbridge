# TD Bridge

TD Bridge is a highly modular, zero-latency, multi-user web controller system designed specifically for TouchDesigner interactive installations. 

It allows 15+ concurrent users to scan a dynamic QR code on their phones and instantly control a live visual via a Google Material Design joystick and action buttons.

## Architecture
1. **Frontend (`src/client`)**: A static HTML/TypeScript mobile web app hosted on GitHub Pages.
2. **Backend (`src/server`)**: A lightweight Node.js relay server that converts WebSockets to UDP OSC.
3. **Engine**: TouchDesigner receives the OSC natively into CHOPs.

## Installation & Local Testing
1. Clone this repository: `git clone https://github.com/Uberkill/tdbridge.git`
2. Install dependencies: `npm install`
3. Build the TypeScript files: `npm run build`
4. Start the backend relay server: `npm start`
5. In a new terminal, serve the frontend: `npx serve public -p 3000`
6. Access the UI on your phone at `http://<YOUR_LOCAL_IP>:3000/?room=<ROOM_CODE>`

## Production Deployment (Cloudflare + GitHub Pages)
To take this live so anyone in the world can connect over 4G/5G:
1. Push this repository to GitHub and enable **GitHub Pages** for the `public/` directory.
2. Install Cloudflare `cloudflared` on your TouchDesigner PC.
3. Expose the Node.js relay server to the internet securely:
   ```bash
   cloudflared tunnel route tcp://localhost:8080 wss://api.yourdomain.com
   ```
4. Update `src/client/app.ts` to connect to `wss://api.yourdomain.com` and rebuild.

## TouchDesigner Integration
You do not need to build the network manually!
1. Create a **Text DAT** in TouchDesigner.
2. Paste the contents of `td_network_builder.py` into it.
3. Right-click the DAT and select **Run Script**.
4. TD Bridge will automatically generate the OSC In, Lag smoothing, and Logic CHOPs for all 15 users.
