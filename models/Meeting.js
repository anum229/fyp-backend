const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
    groupId: {
        type: String,
        required: true
    },
    projectTitle: {
        type: String,
        required: true
    },
    venue: {
        type: String,
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    participants: {
        students: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student"
        }],
        supervisor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
            required: true
        },
        coAdvisor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher"
        }
    },
    status: {
        type: String,
        enum: ["Scheduled", "Completed", "Cancelled"],
        default: "Scheduled"
    },
    createdBy: {
        type: mongoose.Schema.Types.Mixed, // Changed from ObjectId to Mixed
        required: true
    },
}, { timestamps: true });

module.exports = mongoose.model("Meeting", meetingSchema);