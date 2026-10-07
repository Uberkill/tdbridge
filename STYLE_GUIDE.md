# TDBridge Design System & Style Guide

Visual design specification, CSS tokens, and component guidelines for TDBridge across mobile, tablet, and 4K displays.

---

## 1. Principles

1. **High-Contrast Legibility**: Deep black (`#000000`) and stark white (`#ffffff`). Readable in dark concert venues, under stage lighting, or in bright ambient sunlight.
2. **Structural Borders**: Information hierarchy is defined by physical border rules (`2px solid #ffffff` and `1px solid #222226`) rather than decorative drop shadows or color fills.
3. **Tactile Binary Inversion**:
   - **Default (Idle)**: Black background, white border, white text.
   - **Active (Pressed / TouchDown)**: Solid white background, solid black text.
4. **Utilitarian UI**: Clean lines, monospace telemetry, and zero decorative emojis or neon glows.
5. **Universal Scaling**: Fluidly adapts across handheld smartphones (19.5:9), iPads/tablets (4:3), 1080p FHD, and native 4K UHD (3840 x 2160) displays.

---

## 2. Color Palette & Semantic Tokens

```css
:root {
  /* Core Palette */
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

  /* Status Indicators */
  --status-green: #00ff66;       /* Engine 60 FPS / Connected */
  --status-cyan: #00e5ff;        /* Active Vector Trace / Sync */
  --status-amber: #ffaa00;       /* Throttled / Connecting */
  --status-crimson: #ff3b30;     /* Critical Error / Disconnect */

  /* Stage Swatches (Player Identifiers in TouchDesigner) */
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

## 3. Typography Hierarchy

- **Display & Headings**: Space Grotesk (`sans-serif`), uppercase, tight tracking (`0.05em` to `0.1em`).
- **Telemetry & Technical Readouts**: JetBrains Mono (`monospace`), strict fixed-width alignment.

```css
/* Telemetry badge example */
.hud-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-dim);
}
```

---

## 4. Responsive Breakpoints

| Breakpoint Tier | Viewport Min | Card Max-Width | Typography Scale | Target Devices |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` | `clamp(320px, 92vw, 420px)` | Title: `2.0rem`, Code: `1.375rem` | Modern smartphones (19.5:9, 20:9) |
| **Tablet / iPad** | `768px` | `clamp(480px, 58vw, 580px)` | Title: `2.75rem`, Code: `1.75rem` | iPad Mini, iPad 10.2", iPad Pro (4:3) |
| **Desktop FHD** | `1024px` | `clamp(540px, 36vw, 680px)` | Title: `3.25rem`, Code: `2.0rem` | Standard 1080p FHD monitors |
| **Desktop QHD** | `1920px` | `clamp(660px, 32vw, 800px)` | Title: `4.0rem`, Code: `2.5rem` | 1440p QHD displays |
| **4K UHD** | `2560px+` | `clamp(880px, 28vw, 1100px)` | Title: `5.5rem`, Code: `3.5rem` | 4K UHD monitors (3840 x 2160) |

- **iOS Auto-Zoom Defense**: All input fields enforce `font-size: max(16px, 1rem)`.
- **Card Centering**: `margin: auto; max-height: calc(100dvh - 32px); overflow-y: auto;` prevents top clipping in landscape orientation.
