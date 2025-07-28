const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema({
    groupId: {
        type: String,
        required: true,
    },
    groupMembers: [
        {
            type: mongoose.Schema.Types.String,
            ref: "Student"
        }
    ],
    projectTitle: {
        type: String,
        required: true
    },
    pdfUrl: {
        type: String,
        required: true
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ["Pending", "Submitted", "Approved", "Rejected"], 
        default: "Pending"
    },
    aiStatus: {
        type: String,
        enum: ["Pending", "Pass", "Fail"], 
        default: "Pending"
    },
    aiReviewDate: {
        type: Date,
        default: null
    },
    aiFeedback: {
        type: String,
        default: null
    },
    aiFeedbackDescription: {
        type: String,
        default: ""
    },
    fypStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },
    fypActionDate: {
        type: Date,
        default: null
    },
    fypFeedback: {
        type: String,
        default: null
    },
    assigned_teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
        default: null
    },
    assigned_coadvisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
        default: null
    },
    aiSuggestedSupervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
        default: null
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    }
});

module.exports = mongoose.model("Proposal", proposalSchema);