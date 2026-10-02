# TDBridge Design System & Style Guide: Swiss Graphic Monolith

The official enterprise design system, component specification, typography architecture, and fault-tolerance standard for TDBridge across Mobile, Tablet/iPad, and Desktop 4K environments.

---

## 1. Core Philosophy & Architectural Intent

The **Swiss Graphic Monolith** aesthetic draws from International Typographic Style (Swiss Style), brutalist exhibition catalogs, and industrial studio hardware (e.g. Teenage Engineering, Braun, Uncut Lab).

### Guiding Principles
1. **Extreme High-Contrast Legibility**: Pure pitch black (`#000000`) and pure stark white (`#ffffff`). Readable in pitch-black concert arenas, under stage strobe lights, or in bright outdoor sunlight.
2. **Structural Framing Rules**: Information hierarchy is defined by physical border rules (`2px solid #ffffff` and `1px solid #222226`), not decorative shadows or arbitrary color blobs.
3. **Tactile Binary Inversion**: Every interactive element utilizes a stark binary inversion state:
   - **Default (Idle)**: Black background, white border, white text.
   - **Active (Pressed / TouchDown)**: Solid white background, solid black text.
4. **Zero Fluff / No Cheesy Tropes**: No purple/cyan neon drop shadows, no cartoon radii, zero emojis. Sharp, architectural, utilitarian.
5. **Universal Multi-Device Scaling**: Fluidly adapts across handheld smartphones (19.5:9), iPads/tablets (4:3), FHD (1080p), and native 4K UHD (3840 $\times$ 2160) displays.
6. **Fault-Tolerant Resilience**: Every stage failure (packet timeout, engine cook lag, crash) has an explicit, high-contrast, self-healing UI state.

---

## 2. Color Palette & Semantic Tokens

```css
:root {
  /* Core Monolith Palette */
  --bg-black: #000000;
  --bg-surface: #0c0d10;
  --bg-card: #111114;
  --bg-elevated: #16161c;
  
  --text-white: #ffffff;
  --text-dim: #8e8e93;
  --text-muted: #545458;
  --text-black: #000000;
  
  --border-white: #ffffff;
  --border-mid: #333338;
  --border-subtle: #222226;

  /* Inversion States */
  --invert-bg: #ffffff;
  --invert-text: #000000;

  /* Functional Status Indicators */
  --status-green: #00ff66;       /* Engine 60 FPS / Connected */
  --status-cyan: #00e5ff;        /* Active Vector Trace / Sync */
  --status-amber: #ffaa00;       /* Throttled / Connecting */
  --status-crimson: #ff3b30;     /* Critical Error / Disconnect */

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

## 3. Universal Fluid Token Architecture across Breakpoints

To eliminate the "tiny card" bug on 4K monitors while ensuring touch targets conform to mobile accessibility ($\ge 44\text{px}$), dimensions and fonts scale fluidly across 5 media query tiers:

| Token | Mobile (<768px) | Tablet / iPad (768px) | Desktop FHD (1024px) | Desktop QHD (1920px) | Desktop 4K UHD (2560px+) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`--mono-card-w`** | `clamp(320px, 92vw, 420px)` | `clamp(480px, 58vw, 580px)` | `clamp(540px, 36vw, 680px)` | `clamp(660px, 32vw, 800px)` | `clamp(880px, 28vw, 1100px)` |
| **`--mono-title-size`** | `2.0rem` | `2.75rem` | `3.25rem` | `4.0rem` | `5.5rem` |
| **`--mono-code-h`** | `44px` | `56px` | `64px` | `76px` | `104px` |
| **`--mono-code-font`** | `1.375rem` | `1.75rem` | `2.0rem` | `2.5rem` | `3.5rem` |
| **`--mono-input-h`** | `40px` | `48px` | `52px` | `60px` | `84px` |
| **`--mono-input-font`** | `0.875rem` | `1.0rem` | `1.0625rem` | `1.25rem` | `1.75rem` |
| **`--mono-btn-h`** | `48px` | `56px` | `60px` | `70px` | `92px` |
| **`--mono-btn-font`** | `0.9375rem` | `1.125rem` | `1.1875rem` | `1.375rem` | `1.875rem` |
| **`--mono-swatch-h`** | `14px` | `18px` | `20px` | `24px` | `32px` |

- **iOS Safari Touch Auto-Zoom Prevention:** All mobile input fields enforce `font-size: max(16px, 1rem);` so focus events never trigger unintended viewport zooming.
- **Centering & Viewport Clipping Defense:** The main card uses `margin: auto; max-height: calc(100dvh - 32px); overflow-y: auto;` to guarantee full readability on short or landscape screens.

---

## 4. UI Component Library & Visual Hierarchy

### A. Calmed Onboarding Gate (`#gate`)
- **Hero Title (`#brand-title`)**: High-contrast bold Space Grotesk header displaying dynamic event name from TouchDesigner (`Sessionname`).
- **Room Code Cells (`.code-box`)**: 4 segmented cells with 1px precision borders (`#26262a`), centered monospace typography, and subtle placeholder dots (`·`).
- **Callsign Input & Muted Randomizer**: Muted graphite `[ ⟳ RND ]` button (`#555` border, `#888` text) integrated alongside handle input, eliminating screaming cyan text.
- **Stage Palette Micro-Ribbon (`#swatch-group`)**: 14px sleek horizontal color ribbon. Inactive colors rest at `opacity: 0.35`; active color pops with a crisp 1px white bezel.
- **Primary Action (`#join-btn`)**: Prominent, confident `[ ENTER STAGE -> ]` button.

### B. Covert Front-of-House (FOH) Operator Access
- Invisible to audience participants; accessible to authorized staff.
- Micro-trigger pinned to bottom-right corner:
  ```css
  #covert-operator-trigger {
    position: fixed;
    bottom: 12px;
    right: 16px;
    opacity: 0.15;
    font-size: 10px;
    color: #555555;
    transition: opacity 0.2s ease, color 0.2s ease;
  }
  #covert-operator-trigger:hover,
  #covert-operator-trigger:focus {
    opacity: 0.85;
    color: #ffffff;
  }
  ```
- **Hotkeys:** Pressing `Ctrl+Shift+O` or `~` opens the covert password modal.

### C. Precision Analog Joystick & 60Hz Vector Oscilloscope
- **Outer Reticle**: Circular boundary (`border: 2px solid #ffffff`) with center crosshair rules.
- **Oscilloscope Vector Canvas**: 60Hz `<canvas>` rendering velocity decay trails in phosphorescent cyan (`#00e5ff`) with a leading white particle head.
- **Thumb Puck**: Solid black circle with 2px white border, centered player swatch dot.
- **Zero-Latency Return**: Snaps to `X: +0.00 | Y: +0.00` on pointer release.

### D. FOH Master Operator Console (`#master-ui`)
- Full-bleed 3-column workstation layout:
  1. **Show Control & Scene Parameters Rack**: Real-time sliders adapting dynamically to the active scene (`1_Fishtank`, `2_particle_canvas`, `out_qr_top`).
  2. **Performance Core & Roster Table**: Live scrollable attendee roster with slot IDs, handles, RTT, and individual `[DISCONNECT]` triggers.
  3. **Stage Profile & 4-Domain Telemetry HUD**: Live TouchDesigner cook FPS, loopback latency, tunnel health, and 50-item event ring buffer.
