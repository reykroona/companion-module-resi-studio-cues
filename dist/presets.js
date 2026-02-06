"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePresets = UpdatePresets;
const base_1 = require("@companion-module/base");
function UpdatePresets(self) {
    const presets = {};
    presets['mylabel'] = {
        type: 'button',
        category: 'Group One',
        name: 'Name',
        style: {
            text: 'My first Preset button',
            size: 'auto',
            color: (0, base_1.combineRgb)(255, 255, 255),
            bgcolor: (0, base_1.combineRgb)(0, 0, 0),
            show_topbar: false,
        },
        steps: [],
        feedbacks: [],
    };
    self.setPresetDefinitions(presets);
}
//# sourceMappingURL=presets.js.map