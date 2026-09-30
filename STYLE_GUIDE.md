# TDBridge Design System & Style Guide: Swiss Graphic Monolith

The official design system, component specification, and interaction architecture for TDBridge across Mobile, Tablet/iPad, and Desktop environments.

---

## 1. Core Philosophy & Architectural Intent

The **Swiss Graphic Monolith** aesthetic draws from International Typographic Style (Swiss Style), brutalist exhibition catalogs, and industrial studio hardware (e.g. Teenage Engineering, Braun, Uncut Lab).

### Guiding Principles
1. **Extreme High-Contrast Legibility**: Pure pitch black (`#000000`) and pure stark white (`#ffffff`). Readable in pitch-black concert arenas, under stage strobe lights, or in bright sunlight.
2. **Structural Framing Rules**: Information hierarchy is defined by physical border rules (`2px solid #ffffff` and `1px solid #222222`), not decorative shadows or arbitrary color blobs.
3. **Tactile Inversion**: Every interactive element utilizes a stark binary inversion state:
   - Default: Black background, white border, white text.
   - Active / Pressed / Touch: Solid white background, solid black text.
4. **Zero Fluff / No AI Tropes**: No purple/cyan drop shadows, no bubbly cartoon radii, no cheesy emojis. Sharp, architectural, utilitarian.
5. **Omni-Device Ergonomics**: Fluidly adapts across handheld smartphones, iPads/tablets, and desktop PCs with tactile touch and desktop keyboard/mouse fallbacks.

---

## 2. Color Palette & Semantic Tokens

```css
:root {
  /* Core Monolith Palette */
  --bg-primary: #000000;
  --bg-surface: #0a0a0c;
  --bg-elevated: #141418;
  
  --text-primary: #ffffff;
  --text-secondary: #8e8e93;
  --text-muted: #545458;
  
  --border-strong: #ffffff;
  --border-medium: #333333;
  --border-subtle: #1c1c1e;

  /* Inversion States */
  --invert-bg: #ffffff;
  --invert-text: #000000;

  /* Functional Status Indicators */
  --status-live: #00ff66;       /* Engine 60 FPS / Connected */
  --status-warn: #ffcc00;       /* Throttled / Connecting */
  --status-err: #ff3b30;        /* Offline / Disconnected */
  --status-ml: #00e5ff;         /* ML / Inference Tracking State */

  /* Stage Color Swatches (Player Identifiers) */
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

## 3. Typography System & Recommendations

Typography must be geometric, technical, and authoritative.

### Recommended Font Pairings

| Role | Font Family | Fallback Stack | Rationale |
| :--- | :--- | :--- | :--- |
| **Primary Display & Headings** | **Space Grotesk** | `'Syne', 'Helvetica Neue', Arial, sans-serif` | Brutalist geometric sans with distinctive open letterforms and technical uppercase numerals. |
| **Alternative Display** | **PP Neue Montreal** or **Uncut Sans** | `system-ui, sans-serif` | Clean, razor-sharp architectural modernist grotesk. |
| **Telemetry, HUD & Clocks** | **JetBrains Mono** or **Space Mono** | `'Courier New', monospace` | Fixed-pitch alignment for real-time coordinate readouts, FPS counters, and latency figures. |

### Type Scale & Tokens
- **Display Hero**: `2.25rem` (`36px`), `font-weight: 700`, `letter-spacing: -0.03em`, uppercase.
- **Section Headers**: `1.25rem` (`20px`), `font-weight: 700`, `letter-spacing: 0.05em`, uppercase.
- **Control Labels**: `0.875rem` (`14px`), `font-weight: 700`, `letter-spacing: 0.08em`, uppercase.
- **Micro Telemetry**: `0.6875rem` (`11px`), `font-weight: 500`, monospaced, `letter-spacing: 0.1em`, uppercase.

---

## 4. UI Component Library (Atoms & Molecules)

### A. The Structural Block (`.mono-block`)
```css
.mono-block {
  background: var(--bg-surface);
  border: 2px solid var(--border-strong);
  padding: 16px;
  position: relative;
}
```

### B. Inverted Action Button (`.mono-btn`)
- **Idle**: Black background, 2px white border, white text.
- **Hover** (desktop): 1px dashed white outline.
- **Active / TouchDown**: Immediate flip to background `#fff`, text `#000`, `transform: scale(0.98)`.

### C. Precision Analog Joystick (`.mono-joystick`)
- Outer Reticle: Circular boundary with crosshair grid lines extending to border rules.
- Thumb Puck: Solid black circle with 2px white outline and high-contrast center indicator.
- Return Physics: Zero-latency spring return on release, immediate normalized `[-1.0, 1.0]` output.

### D. Multi-Touch Vertical Fader (`.mono-fader`)
- Slender vertical channel with solid white fill rising from the base.
- Numerical readout (`0%` to `100%`) dynamically centered inside the slider head.
- Multi-touch isolation allowing 4 simultaneous fader drags on iPads/phones.

### E. Status & Machine Learning State Pill (`.mono-status`)
Displays live TouchDesigner engine and inference states:
- `[ 60.0 FPS // LIVE ]` (Green indicator)
- `[ ML: TRACKING POSE ]` (Cyan indicator)
- `[ ML: LATENT MORPH 78% ]` (Amber indicator)
- `[ PING: 12ms // SLOT 06 ]` (Monospaced telemetry)

---

## 5. Responsive Layout Architecture

### A. Mobile Phones (Portrait)
- Single-column stacked layout:
  - Top: 44px HUD Bar (Slot badge, Engine link, Exit).
  - Upper: 50% height Analog Joystick or Kaoss surface.
  - Lower: 4-button trigger grid + horizontal macro slider.
  - Safe area insets: `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`.

### B. Tablets & iPads (Landscape / Split View)
- 2-Column Split:
  - Left Column (55% width): Large Analog Joystick / XY tracking area.
  - Right Column (45% width): 4 Action Triggers + Dual Macro Faders + Machine Learning / Show Status Monitor.

### C. Desktop PC (Keyboard & Mouse Bindings)
- Direct mouse drag on Joystick / Faders.
- Standard Keybindings:
  - `W` / `A` / `S` / `D` or Arrow Keys: Joystick directional vectors.
  - `J` / `K` / `L` / `;` (or `1`, `2`, `3`, `4`): Action Buttons 1–4.
  - `Spacebar`: Flash / Strobe momentary toggle.
  - `[` and `]`: Macro slider decrement / increment.
