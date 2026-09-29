"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeBlueprint = exports.BUILTIN_PROFILES = void 0;
exports.BUILTIN_PROFILES = {
    gamepad: {
        id: 'gamepad',
        name: 'Gamepad & Actions',
        type: 'gamepad',
        blueprint: [
            { type: 'button', id: 'b1', alias: 'action1', label: 'Rotate', color: '#4285f4' },
            { type: 'button', id: 'b2', alias: 'action2', label: 'Change Color', color: '#ea4335' },
            { type: 'button', id: 'b3', alias: 'action3', label: 'Feed Fish', color: '#ff9800' },
            { type: 'button', id: 'b4', label: 'Special', color: '#34a853' },
            { type: 'slider', id: 's1', alias: 'slider1', label: 'Speed', color: '#fbbc05', default_val: 0.5, min: 0, max: 1, step: 0.01 },
            { type: 'slider', id: 's2', alias: 'slider2', label: 'Size', color: '#00bcd4', default_val: 0.55, min: 0.35, max: 0.95, step: 0.02 }
        ]
    },
    touchpad: {
        id: 'touchpad',
        name: 'Touchpad & Canvas',
        type: 'touchpad',
        blueprint: [
            { type: 'button', id: 'b1', label: 'Touch Active', color: '#4285f4' },
            { type: 'button', id: 'b2', label: 'Clear / Pulse', color: '#ea4335' },
            { type: 'button', id: 'b3', label: 'Mode Cycle', color: '#34a853' },
            { type: 'slider', id: 's1', label: 'Brush Size', color: '#fbbc05', default_val: 0.5, min: 0.1, max: 1.0, step: 0.01 }
        ]
    },
    faderbank: {
        id: 'faderbank',
        name: 'Fader Bank Mixer',
        type: 'faderbank',
        blueprint: [
            { type: 'slider', id: 's1', label: 'Fader 1 (Ch 1)', color: '#4285f4', default_val: 0.8, min: 0, max: 1, step: 0.01 },
            { type: 'slider', id: 's2', label: 'Fader 2 (Ch 2)', color: '#34a853', default_val: 0.6, min: 0, max: 1, step: 0.01 },
            { type: 'slider', id: 's3', label: 'Fader 3 (Ch 3)', color: '#fbbc05', default_val: 0.4, min: 0, max: 1, step: 0.01 },
            { type: 'slider', id: 's4', label: 'Fader 4 (FX)', color: '#ea4335', default_val: 0.2, min: 0, max: 1, step: 0.01 },
            { type: 'button', id: 'b1', label: 'Flash 1', color: '#4285f4' },
            { type: 'button', id: 'b2', label: 'Flash 2', color: '#34a853' },
            { type: 'button', id: 'b3', label: 'Flash 3', color: '#fbbc05' },
            { type: 'button', id: 'b4', label: 'Strobe', color: '#ea4335' }
        ]
    },
    audience: {
        id: 'audience',
        name: 'Audience Hype & Reactions',
        type: 'audience',
        blueprint: [
            { type: 'reaction', id: 'b1', label: 'Fire', emoji: '🔥', color: '#ff5722' },
            { type: 'reaction', id: 'b2', label: 'Heart', emoji: '❤️', color: '#e91e63' },
            { type: 'reaction', id: 'b3', label: 'Party', emoji: '🎉', color: '#ffeb3b' },
            { type: 'reaction', id: 'b4', label: 'Bolt', emoji: '⚡', color: '#00e5ff' }
        ]
    }
};
/**
 * Validates and sanitizes a custom blueprint provided via OSC or JSON.
 */
function sanitizeBlueprint(items) {
    if (!Array.isArray(items))
        return [];
    const valid = [];
    const allowedTypes = new Set(['button', 'slider', 'dpad', 'toggle', 'reaction']);
    for (const item of items) {
        if (!item || typeof item !== 'object')
            continue;
        const type = String(item.type || '').toLowerCase();
        if (!allowedTypes.has(type))
            continue;
        const id = String(item.id || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 16);
        if (!id)
            continue;
        const label = String(item.label || id).replace(/[<>]/g, '').substring(0, 24);
        const color = typeof item.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : '#4285f4';
        const sanitized = {
            type: type,
            id,
            label,
            color
        };
        if (item.alias)
            sanitized.alias = String(item.alias).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 16);
        if (item.emoji)
            sanitized.emoji = String(item.emoji).substring(0, 4);
        if (type === 'slider') {
            sanitized.min = typeof item.min === 'number' ? item.min : 0;
            sanitized.max = typeof item.max === 'number' ? item.max : 1;
            sanitized.step = typeof item.step === 'number' ? item.step : 0.01;
            const defVal = typeof item.default_val === 'number' ? item.default_val : 0.5;
            sanitized.default_val = Math.max(sanitized.min, Math.min(sanitized.max, defVal));
        }
        valid.push(sanitized);
        if (valid.length >= 24)
            break; // Hard limit 24 controls per blueprint
    }
    return valid;
}
exports.sanitizeBlueprint = sanitizeBlueprint;
