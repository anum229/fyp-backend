const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema({
    groupId: {
        type: String,
        required: true,
        ref: "Proposal"
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Student"
    },
    rollNumber: {
        type: String,
        required: true
    },
    evaluatorType: {
        type: String,
        required: true,
        enum: ["Supervisor", "FYPTeam"],
        default: "FYPTeam"
    },
    midYearEvaluation: {
        completed: {
            type: Boolean,
            default: false
        },
        marks: {
            presentation: {
                type: Number,
                min: 0,
                max: 30,
                default: 0
            },
            srsReport: {
                type: Number,
                min: 0,
                max: 10,
                default: 0
            },
            poster: {
                type: Number,
                min: 0,
                max: 5,
                default: 0
            },
            progressSheet: {
                type: Number,
                min: 0,
                max: 5,
                default: 0
            },
            total: {
                type: Number,
                default: 0
            }
        },
        evaluatedAt: {
            type: Date
        }
    },
    finalYearEvaluation: {
        completed: {
            type: Boolean,
            default: false
        },
        marks: {
            report: {
                type: Number,
                min: 0,
                max: 20,
                default: 0
            },
            finalPresentation: {
                type: Number,
                min: 0,
                max: 30,
                default: 0
            },
            total: {
                type: Number,
                default: 0
            }
        },
        evaluatedAt: {
            type: Date
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    }
}, { timestamps: true });

evaluationSchema.index(
    { groupId: 1, studentId: 1, evaluatorType: 1 }, 
    { unique: true }
);

// Calculate totals before saving
evaluationSchema.pre("save", function(next) {
    // Calculate Mid-Year total if marks exist
    if (this.midYearEvaluation?.marks) {
        const midMarks = this.midYearEvaluation.marks;
        midMarks.total = 
            (midMarks.presentation || 0) +
            (midMarks.srsReport || 0) +
            (midMarks.poster || 0) +
            (midMarks.progressSheet || 0);
    }

    // Calculate Final-Year total if marks exist
    if (this.finalYearEvaluation?.marks) {
        const finalMarks = this.finalYearEvaluation.marks;
        finalMarks.total = 
            (finalMarks.report || 0) +
            (finalMarks.finalPresentation || 0);
    }
    next();
});

// Calculate totals before findOneAndUpdate
evaluationSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    const midYearMarks = update.$set?.['midYearEvaluation.marks'] || update.midYearEvaluation?.marks;
    const finalYearMarks = update.$set?.['finalYearEvaluation.marks'] || update.finalYearEvaluation?.marks;

    if (midYearMarks) {
        midYearMarks.total = 
            (midYearMarks.presentation || 0) +
            (midYearMarks.srsReport || 0) +
            (midYearMarks.poster || 0) +
            (midYearMarks.progressSheet || 0);
    }

    if (finalYearMarks) {
        finalYearMarks.total = 
            (finalYearMarks.report || 0) +
            (finalYearMarks.finalPresentation || 0);
    }

    next();
});

module.exports = mongoose.model("Evaluation", evaluationSchema);