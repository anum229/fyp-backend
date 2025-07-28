const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    recipients: {
        students: {
            type: Boolean,
            default: false,
        },
        teachers: {
            type: Boolean,
            default: false,
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("Notification", notificationSchema);