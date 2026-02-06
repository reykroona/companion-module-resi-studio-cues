"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFeedbacks = UpdateFeedbacks;
const base_1 = require("@companion-module/base");
function UpdateFeedbacks(self) {
    self.setFeedbackDefinitions({
        ChannelState: {
            name: 'Example Feedback',
            type: 'boolean',
            defaultStyle: {
                bgcolor: (0, base_1.combineRgb)(255, 0, 0),
                color: (0, base_1.combineRgb)(0, 0, 0),
            },
            options: [
                {
                    id: 'num',
                    type: 'number',
                    label: 'Test',
                    default: 5,
                    min: 0,
                    max: 10,
                },
            ],
            callback: (feedback) => {
                console.log('Hello world!', feedback.options.num);
                if (Number(feedback.options.num) > 5) {
                    return true;
                }
                else {
                    return false;
                }
            },
        },
    });
}
//# sourceMappingURL=feedbacks.js.map