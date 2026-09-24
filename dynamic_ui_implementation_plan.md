# Implementation Plan: Server-Driven Dynamic UI for TouchDesigner (V2 - Audited)

## Architecture Overview
The frontend web application becomes a "blank canvas" that generates its interface dynamically based on a JSON blueprint sent from TouchDesigner upon connection. TouchDesigner acts as the single source of truth for the UI layout and interaction mapping.

## Component Breakdown

### 1. TouchDesigner Data Source (`ui_config` DAT)
A new Table DAT in `tdbridge_test` named `ui_config`.
**Columns:**
- `id`: Unique identifier (e.g., `btn_1`)
- `type`: UI element type (e.g., `button`, `toggle`, `slider`)
- `label`: Display text on the mobile phone
- `color`: Hex color code for the UI element
- `default_val`: Starting state/value (e.g., 0 for buttons, 0.5 for sliders)
- `min`: Minimum bound (Required for sliders)
- `max`: Maximum bound (Required for sliders)
- `step`: Step value (Optional for sliders)

### 2. The Handshake (Python WebSocket logic)
When the WebSocket Server DAT receives a `join` message:
1. Parse the `ui_config` DAT into a JSON array of dictionary objects.
2. Send the UI payload alongside the `assigned_slot` message.
**Example Payload:**
```json
{
  "type": "assigned_slot",
  "slot": 1,
  "ui_blueprint": [
    {"id": "btn_1", "type": "button", "label": "Pulse", "color": "#FF0000", "default_val": 0},
    {"id": "slider_1", "type": "slider", "label": "Speed", "color": "#00FF00", "default_val": 50, "min": 0, "max": 100}
  ]
}
```

### 3. State Management & Hardening (`user_data` Table)
1. **Dynamic Initialization:** When the TouchDesigner bridge boots up, it reads `ui_config` and dynamically generates the columns in `user_data`: `client, name, x, y, <id_1>, <id_2>...`.
2. **Safe Defaults:** When a new user joins, their row is explicitly populated with the `default_val` from the schema for every dynamic column, ensuring DAT-to-CHOP operations never fail on empty strings.
3. **Payload Sanitization:** When an `{"type": "control", "id": "btn_1", "value": 1}` payload arrives, the Python script must explicitly check if the `id` exists in the schema before writing to the table, dropping malformed payloads.

### 4. Frontend Mobile Client (`app.ts`)
- Remove hardcoded `<button>` HTML elements and add `<div id="dynamic-controls"></div>`.
- On receiving `ui_blueprint`, iterate and create DOM elements based on `type`.
- **Edge Case Protection:** Attach strict `touchend`, `touchcancel`, and `mouseleave` listeners to momentary buttons to guarantee `value: 0` is sent upon release, preventing stuck button states.
- Listen for `input`/`change` events for sliders, dynamically mapping the schema's `min`/`max` ranges.

### 5. Replicator & Visual Logic
With dynamic UI, the TouchDesigner creator can wire the `user_data` table into a DAT-to-CHOP. Because defaults are safely initialized, this automatically generates a clean, numeric CHOP channel for every dynamic button and slider. The creator can then route these channels to drive any visuals, audio, or lighting logic without writing Python.
