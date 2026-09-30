# TDBridge Design System & Style Guide: Swiss Graphic Monolith

The official enterprise design system, component specification, typography architecture, and fault-tolerance standard for TDBridge across Mobile, Tablet/iPad, and Desktop environments.

---

## 1. Core Philosophy & Architectural Intent

The **Swiss Graphic Monolith** aesthetic draws from International Typographic Style (Swiss Style), brutalist exhibition catalogs, and industrial studio hardware (e.g. Teenage Engineering, Braun, Uncut Lab).

### Guiding Principles
1. **Extreme High-Contrast Legibility**: Pure pitch black (`#000000`) and pure stark white (`#ffffff`). Readable in pitch-black concert arenas, under stage strobe lights, or in bright outdoor sunlight.
2. **Structural Framing Rules**: Information hierarchy is defined by physical border rules (`2px solid #ffffff` and `1px solid #333338`), not decorative shadows or arbitrary color blobs.
3. **Tactile Binary Inversion**: Every interactive element utilizes a stark binary inversion state:
   - **Default (Idle)**: Black background, white border, white text.
   - **Active (Pressed / TouchDown)**: Solid white background, solid black text.
4. **Zero Fluff / No AI Tropes**: No purple/cyan drop shadows, no bubbly cartoon radii, no cheesy emojis. Sharp, architectural, utilitarian.
5. **Omni-Device Ergonomics**: Fluidly adapts across handheld smartphones, iPads/tablets, and desktop PCs with tactile touch and desktop keyboard/mouse hotkeys.
6. **Fault-Tolerant Resilience**: Every stage failure (packet timeout, engine cook lag, crash) has an explicit, high-contrast, self-healing UI state.

---

## 2. Color Palette & Semantic Tokens

```css
:root {
  /* Core Monolith Palette */
  --bg-black: #000000;
  --bg-surface: #0a0a0c;
  --bg-card: #111114;
  --bg-elevated: #16161c;
  
  --text-white: #ffffff;
  --text-dim: #8e8e93;
  --text-muted: #545458;
  --text-black: #000000;
  
  --border-white: #ffffff;
  --border-mid: #333338;
  --border-subtle: #1f1f24;

  /* Inversion States */
  --invert-bg: #ffffff;
  --invert-text: #000000;

  /* Functional Status Indicators */
  --status-green: #00ff66;       /* Engine 60 FPS / Connected */
  --status-cyan: #00e5ff;        /* ML / Active Inference / Vector Trace */
  --status-amber: #ffaa00;       /* Throttled / Latent Freeze / Connecting */
  --status-crimson: #ff3b30;     /* Critical Error / Disconnect / Chaos Breakdown */

  /* Stage Color Swatches (Player Identifiers in TouchDesigner) */
  --swatch-cyan: #00f0ff;
  --swatch-magenta: #ff007f;
  --swatch-lime: #39ff14;
  --swatch-amber: #ffaa00;
  --swatch-purple: #8a2be2;
  --swatch-crimson: #ff3b30;
  --swatch-teal: #00e5ff;
  --swatch-white: #ffffff;
}
```

---

## 3. Typography System & Font Recommendations

Typography must be geometric, technical, and authoritative. All font definitions must feature bulletproof air-gapped system fallbacks for isolated offline stage networks.

### Recommended Font Pairings

| Role | Primary Font | Air-Gapped Fallback Stack | Visual Character & Rationale |
| :--- | :--- | :--- | :--- |
| **Primary Display & Headings** | **Space Grotesk** (700) | `'Syne', -apple-system, system-ui, sans-serif` | Brutalist geometric grotesk with sharp angled terminals and technical uppercase characters. Built for headers, brand identity, and action triggers. |
| **Architectural Hero & Modals** | **Syne** (800) | `'Helvetica Neue', Arial, sans-serif` | Extra-bold architectural sans with radical proportion shifts. Ideal for exhibition hero titles, modal alerts, and avant-garde VJ branding. |
| **Alternative Modernist** | **PP Neue Montreal** or **Uncut Sans** | `system-ui, sans-serif` | Razor-sharp European modernist grotesque. |
| **Telemetry, Coordinates & Clocks** | **JetBrains Mono** (500/700) | `'Space Mono', 'SF Mono', Consolas, monospace` | Fixed-pitch engineering monospaced typeface with slashed zero, distinct glyphs (`0/O`, `1/l`), and rigid tabular alignment. |

### Type Scale & Hierarchy Tokens
- **Display Hero**: `2.25rem` (`36px`), `font-weight: 700`, `letter-spacing: -0.02em`, uppercase, `line-height: 1.0`.
- **Modal & Header**: `1.25rem` (`20px`), `font-weight: 700`, `letter-spacing: -0.01em`, uppercase.
- **Trigger Primary**: `1.0625rem` (`17px`), `font-weight: 700`, `letter-spacing: 0.06em`, uppercase.
- **Section & Sub-Labels**: `0.6875rem` (`11px`), `font-weight: 700`, `letter-spacing: 0.1em`, monospaced, uppercase.
- **Micro Telemetry**: `0.625rem` (`10px`), `font-weight: 500`, `letter-spacing: 0.12em`, monospaced, uppercase.

---

## 4. UI Component Library (Atoms & Molecules)

### A. The Structural Block (`.mono-card`, `.workspace-pane`)
```css
.workspace-pane {
  background: var(--bg-black);
  border: 2px solid var(--border-white);
  padding: 14px;
  position: relative;
}
```

### B. Inverted Action Trigger (`.mono-trigger`, `.mono-btn`)
- **Default (Idle)**: Black background, 2px white border, white text.
- **Active / TouchDown**: Immediate flip to background `#ffffff`, text `#000000`, `transform: scale(0.97)`.
- **Haptics**: `navigator.vibrate(12)` on pointer down.

### C. Precision Analog Joystick & 60Hz Vector Oscilloscope
- **Outer Reticle**: Circular boundary (`border: 2px solid #ffffff`) with center crosshair rules.
- **Oscilloscope Vector Canvas**: 60Hz `<canvas>` rendering velocity decay trails in phosphorescent cyan (`#00e5ff`) with a leading white particle head.
- **HiDPI Scaling**: Scaled dynamically by `window.devicePixelRatio`.
- **Thumb Puck**: Solid black circle with 2px white border, centered player swatch dot.
- **Zero-Latency Return**: Snaps to `X: +0.00 | Y: +0.00` on pointer release.

### D. Continuous Latent XY Kaoss Pad
- Full-bleed 2D touch surface with subtle grid lines (`40px x 40px`).
- Normalized Cartesian coordinates (`U: [0.000, 1.000]`, `V: [0.000, 1.000]`).
- Cyan crosshair reticle box tracking touch point anywhere on screen.

### E. VJ 4-Channel Mixer Faders
- 4 vertical slider channels with solid white fill rising from the base.
- Numerical percentage readout (`0%` to `100%`) updated at 60Hz.
- Independent channel kill/mute and master strobe buttons.
- Touch gesture lock preventing page scroll during multi-finger mixing.

---

## 5. Generative Machine Learning (ML) Operational States

For modern TouchDesigner AI pipelines (StreamDiffusion, ComfyUI, YOLO, latent audio-reactivity), TDBridge exposes 5 standardized operational states:

| State Key | Label & Badge | Visual Indicator | Behavioral Meaning |
| :--- | :--- | :--- | :--- |
| `STANDBY` | `[ STANDBY // BYPASS ]` | Dim Gray / Neutral | Generative pipeline bypassed; raw video passthrough. |
| `INFERENCE` | `[ REALTIME INFERENCE // 60 FPS ]` | Phosphor Green (`#00ff66`) | Live generative diffusion running at 60.0 FPS. |
| `LATENT_LOCK` | `[ LATENT HOLD // SEED #8942 ]` | Amber (`#ffaa00`) | Latent seed locked/frozen; modulation parameters drift around it. |
| `STYLE_MORPH` | `[ STYLE MORPH // LORA 65% ]` | Electric Cyan (`#00e5ff`) | Interpolating between style checkpoints or prompt embeddings. |
| `CHAOS` | `[ HIGH ENTROPY // CHAOS: 92% ]` | Crimson (`#ff3b30`) | Noise injection at peak level for breakdown visual drops. |

---

## 6. Resilient Fault State Architecture & Recovery

### A. Segmented Brutalist Loading Bar (`#modal-loading`)
- 10-block mechanical meter: `[■■■■■■□□□□] 60% SYNC`.
- Sequential progress strings:
  1. `01: VERIFYING PROTOCOL (UDP 9000)`
  2. `02: RESERVING PLAYER SLOT`
  3. `03: SYNCING UI BLUEPRINT`
  4. `04: LOCKING 60FPS LINK`
- Built-in 4.0s timeout watchdog to prevent hanging on dropped packets.

### B. Signal Loss & Auto-Reconnect Watchdog (`#modal-disconnect`)
- Stark modal alert: `CRITICAL SIGNAL LOSS // WEBSOCKET PIPE TERMINATED`.
- **Exponential Backoff with Jitter**:
  `delay = Math.min(10000, 1500 * Math.pow(1.5, attempt) + Math.random() * 500)`.
- Live countdown ticker: `AUTO-RECONNECTING IN 2.1s (ATTEMPT 1/5)...`.
- Manual override: `[FORCE RECONNECT]` and `[ABORT TO GATE]`.
- Preserves player identity, room code, and selected color swatch across disconnects.

### C. TouchDesigner Engine Cook & Lag Alerts
- Client-side monitoring of incoming engine heartbeat.
- **Normal**: `[ 60.0 FPS // LINKED ]` (Green).
- **Throttled**: `[ WARNING // 24.2 FPS // TD HIGH COOK 41.5ms ]` (Crimson).

### D. Session Exit Guard (`#modal-exit`)
- Modal confirmation drawer: `TERMINATE PERFORMANCE SESSION? RELEASING SLOT WILL CLEAR ACTIVE PARTICLES. [CONFIRM] [CANCEL]`.

### E. Emergency Crash Recovery Boundary (`#modal-crash`)
- Catches unhandled runtime exceptions or WebGL context losses.
- Displays raw monospaced stack trace in red.
- Action: `[HOT RELOAD SURFACE]` resets state and restores socket pipe in 1 click.

---

## 7. Omni-Device Usability Matrix

### A. Mobile Smartphones (Portrait Ergonomics)
- Viewport width: `320px – 430px`.
- Single-column stacked layout:
  - Top: 48px HUD Bar (Slot badge, Engine link, Exit trigger).
  - Upper: Analog reticle joystick (240px circle) with 60Hz vector oscilloscope.
  - Lower: 4-trigger block (min-height 68px) + horizontal macro fader.
- Safe area insets: `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`.

### B. Tablets & iPads (Landscape Dual-Pane Workstation)
- Viewport width: `768px – 1366px`.
- 2-Column Split:
  - **Left Pane (55% width)**: Large Analog Joystick or Latent XY Kaoss tracking zone.
  - **Right Pane (45% width)**: 4-Trigger Block + Macro Slider + ML State Monitor.
- Multi-finger isolation allowing left-hand joystick steering while right-hand fires triggers.

### C. Desktop PC (Keyboard & Mouse Studio Mode)
- Full viewport scaling with visual keyboard shortcut HUD:
  - `W` / `A` / `S` / `D` or Arrow Keys: Analog vector navigation.
  - `1`, `2`, `3`, `4`: Action Triggers 1–4.
  - `Spacebar`: Flash / Strobe momentary toggle.
  - `Tab`: Switch controller surface (Gamepad -> Latent XY -> VJ Mixer).
  - `C`: Cycle generative ML state.
  - `[` and `]`: Macro slider decrement / increment.
- Explicit `e.preventDefault()` calls and `document.activeElement` guards to ensure typing names never triggers game controls.

---

## 8. Gesture & Touch Isolation Rules
```css
html, body, .screen-enclosure {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  overscroll-behavior: none;
}
```
- In JavaScript, multi-touch events are bound with `{ passive: false }` to cancel elastic iOS bounce or pinch-zoom gestures.
- Pointer capture (`setPointerCapture`) guarantees uninterrupted tracking even if a finger leaves the reticle bounds.
