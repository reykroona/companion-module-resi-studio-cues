"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFeedbacks = UpdateFeedbacks;
const base_1 = require("@companion-module/base");
function UpdateFeedbacks(self) {
    self.setFeedbackDefinitions({
        resi_connected: {
            name: 'Resi: Connected (auth OK)',
            type: 'boolean',
            defaultStyle: {
                bgcolor: (0, base_1.combineRgb)(0, 200, 0),
                color: (0, base_1.combineRgb)(0, 0, 0),
            },
            options: [],
            callback: () => {
                const v = self.getVariableValue('auth_status') ?? '';
                return v === 'OK';
            },
        },
        resi_error: {
            name: 'Resi: Error (auth/API)',
            type: 'boolean',
            defaultStyle: {
                bgcolor: (0, base_1.combineRgb)(200, 0, 0),
                color: (0, base_1.combineRgb)(255, 255, 255),
            },
            options: [],
            callback: () => {
                const auth = (self.getVariableValue('auth_status') ?? '').trim();
                const err = (self.getVariableValue('last_error') ?? '').trim();
                // True when we have an error message OR auth isn't OK (but ignore "Missing credentials" if you prefer)
                return err.length > 0 || (auth.length > 0 && auth !== 'OK');
            },
        },
        player_active: {
            name: 'Resi: Player active (position > 0s)',
            type: 'boolean',
            defaultStyle: {
                bgcolor: (0, base_1.combineRgb)(0, 120, 255),
                color: (0, base_1.combineRgb)(255, 255, 255),
            },
            options: [],
            callback: () => {
                const s = self.getVariableValue('current_position_sec') ?? '0';
                const n = Number(s);
                return Number.isFinite(n) && n > 0;
            },
        },
        approaching_next_cue: {
            name: 'Resi: Approaching next cue (<= threshold seconds)',
            type: 'boolean',
            defaultStyle: {
                bgcolor: (0, base_1.combineRgb)(255, 180, 0),
                color: (0, base_1.combineRgb)(0, 0, 0),
            },
            options: [
                {
                    id: 'threshold',
                    type: 'number',
                    label: 'Threshold (seconds)',
                    default: 30,
                    min: 1,
                    max: 3600,
                },
            ],
            callback: (fb) => {
                const nextName = (self.getVariableValue('next_cue_name') ?? '').trim();
                if (!nextName)
                    return false;
                const s = self.getVariableValue('next_cue_time_in_seconds') ?? '';
                const n = Number(s);
                if (!Number.isFinite(n))
                    return false;
                const thr = Number(fb.options.threshold);
                return Number.isFinite(thr) ? n <= thr : false;
            },
        },
        playback_frozen: {
            name: 'Resi: Playback frozen (position not changing)',
            type: 'boolean',
            defaultStyle: {
                bgcolor: (0, base_1.combineRgb)(200, 0, 0),
                color: (0, base_1.combineRgb)(255, 255, 255),
            },
            options: [
                {
                    id: 'staleSeconds',
                    type: 'number',
                    label: 'Frozen if unchanged for (seconds)',
                    default: 6,
                    min: 2,
                    max: 120,
                },
            ],
            callback: (fb) => {
                const staleSeconds = Number(fb.options.staleSeconds) || 6;
                const curStr = self.getVariableValue('current_position_sec') ?? '';
                const cur = Number(curStr);
                if (!Number.isFinite(cur))
                    return false;
                const now = Date.now();
                const lastStr = self.getVariableValue('playback_last_change_epoch_ms') ?? '';
                const last = Number(lastStr);
                // If you haven't implemented playback_last_change_epoch_ms yet, we can't detect freezing reliably.
                if (!Number.isFinite(last) || last <= 0)
                    return false;
                const ageSec = (now - last) / 1000;
                return ageSec >= staleSeconds;
            },
        },
    });
}
//# sourceMappingURL=feedbacks.js.map