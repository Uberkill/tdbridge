# TDBridge: Modular Multi-User Web Controller

TDBridge is a zero-latency, server-driven multi-user web controller built directly inside TouchDesigner. It allows 100+ concurrent users to scan a QR code on their phones, connect instantly via Cloudflare tunnels, and control live visuals without installing an app.

## The "Server-Driven Dynamic UI" Architecture
Unlike traditional web apps where the buttons are hardcoded in HTML, **TDBridge is 100% controlled by TouchDesigner**.
- Inside the TouchDesigner component, there is a `ui_config` Table DAT.
- You can add buttons, toggles, and sliders just by typing rows into this spreadsheet.
- When a phone connects, TouchDesigner sends it a JSON blueprint. The mobile web app dynamically constructs massive, Dark Mode action buttons and sliders to match your blueprint instantly.

## 1-Click Startup Automation
You do not need to be a network engineer to run this.
1. Run `Start_System.bat` on the TouchDesigner PC.
2. The script will automatically launch a secure `cloudflared` tunnel, bypassing local firewalls and exposing your TouchDesigner server to the global internet safely.

## Robust Error Handling & Ghost Client Mitigation
TDBridge is heavily optimized for live events where cellular connections drop constantly:
- **Instant Cleanup:** When a user closes their browser or their connection drops, the WebSocket closes gracefully. TouchDesigner instantly intercepts this in `onWebSocketClose` and deletes their row from the database. Their visual avatar disappears instantly.
- **Auto-Reconnection:** If a user locks their iPhone screen, iOS Safari suspends the connection. TDBridge uses a `visibilitychange` listener—the millisecond the user unlocks their phone, it reboots the network loop and seamlessly slots them back into the game without requiring a page refresh.
- **Input Sanitization:** Malformed packets or rogue JSON payloads from hackers are strictly validated against the `ui_config` schema in TouchDesigner. Invalid commands are silently dropped to prevent Python crashes.

## Local Development
1. Clone this repository.
2. `npm install`
3. Modify TypeScript in `src/client/app.ts`.
4. Compile with `npx tsc src/client/app.ts --outDir public`
5. The `public/` directory is automatically served to GitHub Pages via GitHub Actions.
