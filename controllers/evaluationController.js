const mongoose = require('mongoose');
const Evaluation = require('../models/Evaluation');
const Proposal = require('../models/Proposal');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher'); // Add this import

const getEligibleGroups = async (req, res) => {
    try {
        const proposals = await Proposal.find({
            fypStatus: "Approved",
            assigned_teacher: { $exists: true, $ne: null }
        })
        .populate('assigned_teacher', 'name')
        .populate('assigned_coadvisor', 'name')
        .lean();

        if (proposals.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No eligible groups found"
            });
        }

        const evaluations = await Evaluation.find({
            groupId: { $in: proposals.map(p => p.groupId) }
        }).populate('studentId', 'name rollNumber');

        const response = proposals.map(proposal => {
            const groupEvaluations = evaluations.filter(e => e.groupId === proposal.groupId);
            
            return {
                groupId: proposal.groupId,
                department: proposal.department || "CE",
                projectTitle: proposal.projectTitle,
                assignedTeacher: proposal.assigned_teacher?.name || "Unassigned",
                coAdvisor: proposal.assigned_coadvisor?.name || null,
                groupMembers: proposal.groupMembers,
                evaluations: groupEvaluations.map(eval => ({
                    studentId: eval.studentId._id,
                    rollNumber: eval.rollNumber,
                    studentName: eval.studentId?.name || "Unknown",
                    evaluatorType: eval.evaluatorType,
                    midYearEvaluation: eval.midYearEvaluation,
                    finalYearEvaluation: eval.finalYearEvaluation,
                    createdAt: eval.createdAt,
                    updatedAt: eval.updatedAt
                })),
                evaluationStatus: {
                    midYearCompleted: groupEvaluations.some(e => e.midYearEvaluation.completed),
                    finalYearCompleted: groupEvaluations.some(e => e.finalYearEvaluation.completed),
                    totalMembers: proposal.groupMembers.length,
                    midYearEvaluated: groupEvaluations.filter(e => e.midYearEvaluation.completed).length,
                    finalYearEvaluated: groupEvaluations.filter(e => e.finalYearEvaluation.completed).length
                }
            };
        });

        res.status(200).json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error("Error in getEligibleGroups:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch eligible groups: " + error.message
        });
    }
};

const getGroupEvaluations = async (req, res) => {
    try {
        const { groupId } = req.params;

        const proposal = await Proposal.findOne({ 
            groupId,
            fypStatus: "Approved",
            assigned_teacher: { $exists: true, $ne: null }
        })
        .populate('assigned_teacher', 'name')
        .populate('assigned_coadvisor', 'name')
        .lean();

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: "Group not found or not eligible for evaluation"
            });
        }

        const evaluations = await Evaluation.find({ groupId })
            .populate('studentId', 'name rollNumber');

        const response = {
            groupId: proposal.groupId,
            department: proposal.department || "CE",
            projectTitle: proposal.projectTitle,
            assignedTeacher: proposal.assigned_teacher?.name || "Unassigned",
            coAdvisor: proposal.assigned_coadvisor?.name || null,
            groupMembers: proposal.groupMembers,
            evaluations: evaluations.map(eval => ({
                studentId: eval.studentId._id,
                rollNumber: eval.rollNumber,
                studentName: eval.studentId?.name || "Unknown",
                evaluatorType: eval.evaluatorType,
                midYearEvaluation: eval.midYearEvaluation,
                finalYearEvaluation: eval.finalYearEvaluation,
                createdAt: eval.createdAt,
                updatedAt: eval.updatedAt
            })),
            evaluationStatus: {
                midYearCompleted: evaluations.some(e => e.midYearEvaluation.completed),
                finalYearCompleted: evaluations.some(e => e.finalYearEvaluation.completed),
                totalMembers: proposal.groupMembers.length,
                midYearEvaluated: evaluations.filter(e => e.midYearEvaluation.completed).length,
                finalYearEvaluated: evaluations.filter(e => e.finalYearEvaluation.completed).length
            }
        };

        res.status(200).json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error("Error in getGroupEvaluations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch evaluations: " + error.message
        });
    }
};

const getStudentEvaluation = async (req, res) => {
    try {
        const { rollNumber } = req.params;

        const student = await Student.findOne({ rollNumber });
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const evaluation = await Evaluation.findOne({
            studentId: student._id
        }).populate('studentId', 'name rollNumber');

        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: "Evaluation record not found for this student"
            });
        }

        res.status(200).json({
            success: true,
            data: evaluation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// evaluationController.js
const saveEvaluation = async (req, res) => {
    try {
        const { groupId, rollNumber, evaluationType, marks } = req.body;

        if (!groupId || !rollNumber || !evaluationType || !marks) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const student = await Student.findOne({ 
            rollNumber,
            groupID: groupId 
        });

        if (!student) {
            return res.status(400).json({
                success: false,
                message: `Student ${rollNumber} does not belong to group ${groupId}`
            });
        }

        // Build the update object
        const updateData = {
            groupId,
            studentId: student._id,
            rollNumber,
            evaluatorType: "FYPTeam",
            createdBy: req.user.id,
            updatedAt: new Date()
        };

        // Set evaluation-specific data
        if (evaluationType === "MidYear") {
            updateData.midYearEvaluation = {
                completed: true,
                marks: {
                    presentation: marks.presentation,
                    srsReport: marks.srsReport,
                    poster: marks.poster,
                    progressSheet: marks.progressSheet
                },
                evaluatedAt: new Date()
            };
        } else {
            updateData.finalYearEvaluation = {
                completed: true,
                marks: {
                    report: marks.report,
                    finalPresentation: marks.finalPresentation
                },
                evaluatedAt: new Date()
            };
        }

        // Use findOneAndUpdate with the correct filter
        const evaluation = await Evaluation.findOneAndUpdate(
            { 
                groupId,
                studentId: student._id,
                evaluatorType: "FYPTeam"
            },
            updateData,
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true 
            }
        ).populate('studentId', 'name rollNumber');

        res.status(200).json({
            success: true,
            message: `${evaluationType} evaluation saved for student ${rollNumber}`,
            data: evaluation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

//Get Supervisor's Evaluation By FYP
const getSupervisorEvaluationsForFYP = async (req, res) => {
    try {
        const { groupId } = req.params;

        // Get evaluations with proper population
        const evaluations = await Evaluation.find({
            groupId,
            evaluatorType: "Supervisor"
        })
        .populate({
            path: 'studentId',
            select: 'name rollNumber'
        })
        .populate({
            path: 'createdBy',
            select: 'name teacherID',
            model: 'Teacher' // Explicitly specify model
        });

        // Format response with fallback values
        const response = {
            groupId,
            evaluations: evaluations.map(eval => ({
                studentId: eval.studentId?._id || null,
                rollNumber: eval.rollNumber,
                studentName: eval.studentId?.name || "Unknown Student",
                evaluatedBy: {
                    name: eval.createdBy?.name || "Unknown Supervisor",
                    teacherId: eval.createdBy?.teacherID || "N/A"
                },
                midYear: eval.midYearEvaluation.completed ? {
                    marks: eval.midYearEvaluation.marks,
                    evaluatedAt: eval.midYearEvaluation.evaluatedAt
                } : null,
                finalYear: eval.finalYearEvaluation.completed ? {
                    marks: eval.finalYearEvaluation.marks,
                    evaluatedAt: eval.finalYearEvaluation.evaluatedAt
                } : null
            }))
        };

        res.status(200).json({
            success: true,
            data: response
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all groups assigned to supervisor with evaluation status
const getSupervisorGroups = async (req, res) => {
    try {
        // 1. Get all groups assigned to this supervisor
        const proposals = await Proposal.find({
            assigned_teacher: req.user.id,
            fypStatus: "Approved"
        })
        .populate('assigned_teacher', 'name')
        .populate('assigned_coadvisor', 'name')
        .lean();

        if (!proposals.length) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No groups assigned for evaluation"
            });
        }

        // 2. Get all evaluations for these groups (both types)
        const groupIds = proposals.map(p => p.groupId);
        const allEvaluations = await Evaluation.find({
            groupId: { $in: groupIds }
        }).populate('studentId', 'name rollNumber');

        // 3. Process each group
        const response = proposals.map(proposal => {
            const totalMembers = proposal.groupMembers.length;
            
            // Separate evaluations by type
            const supervisorEvals = allEvaluations.filter(
                e => e.groupId === proposal.groupId && 
                     e.evaluatorType === "Supervisor"
            );
            
            const fypTeamEvals = allEvaluations.filter(
                e => e.groupId === proposal.groupId && 
                     e.evaluatorType === "FYPTeam"
            );

            // Helper function to calculate evaluation status
            const getStatus = (evals, type) => {
                const completed = evals.filter(
                    e => e[`${type}Evaluation`]?.completed
                );
                return {
                    completed: completed.length === totalMembers,
                    evaluatedCount: completed.length,
                    totalMembers
                };
            };

            return {
                groupId: proposal.groupId,
                projectTitle: proposal.projectTitle,
                assignedTeacher: proposal.assigned_teacher?.name,
                coAdvisor: proposal.assigned_coadvisor?.name,
                groupMembers: proposal.groupMembers,
                evaluationStatus: {
                    bySupervisor: {
                        midYear: getStatus(supervisorEvals, 'midYear'),
                        finalYear: getStatus(supervisorEvals, 'finalYear')
                    },
                    byFYPTeam: {
                        midYear: getStatus(fypTeamEvals, 'midYear'),
                        finalYear: getStatus(fypTeamEvals, 'finalYear')
                    }
                }
            };
        });

        res.status(200).json({ 
            success: true, 
            data: response 
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch supervisor groups: " + error.message 
        });
    }
};

// Save supervisor evaluation
const saveSupervisorEvaluation = async (req, res) => {
    try {
        const { groupId, rollNumber, evaluationType, marks } = req.body;

        // Validate group assignment
        const isAssigned = await Proposal.exists({
            groupId,
            assigned_teacher: req.user.id
        });
        if (!isAssigned) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to evaluate this group"
            });
        }

        const student = await Student.findOne({ 
            rollNumber,
            groupID: groupId 
        });
        if (!student) {
            return res.status(400).json({
                success: false,
                message: `Student ${rollNumber} not found in group ${groupId}`
            });
        }

        const updateData = {
            groupId,
            studentId: student._id,
            rollNumber,
            evaluatorType: "Supervisor", // Force supervisor type
            createdBy: req.user.id,
            updatedAt: new Date()
        };

        if (evaluationType === "MidYear") {
            updateData.midYearEvaluation = {
                completed: true,
                marks: {
                    presentation: marks.presentation,
                    srsReport: marks.srsReport,
                    poster: marks.poster,
                    progressSheet: marks.progressSheet
                },
                evaluatedAt: new Date()
            };
        } else {
            updateData.finalYearEvaluation = {
                completed: true,
                marks: {
                    report: marks.report,
                    finalPresentation: marks.finalPresentation
                },
                evaluatedAt: new Date()
            };
        }

        const evaluation = await Evaluation.findOneAndUpdate(
            { 
                groupId,
                studentId: student._id,
                evaluatorType: "Supervisor" // Unique for supervisor
            },
            updateData,
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true 
            }
        ).populate('studentId', 'name rollNumber');

        res.status(200).json({
            success: true,
            message: `Supervisor ${evaluationType} evaluation saved`,
            data: evaluation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get FYPTeam evaluations for supervisor's group
const getGroupFypEvaluations = async (req, res) => {
    try {
        // 1. Get teacher's ID from token
        const teacherId = req.user.id;

        // 2. Find the teacher to get their supervised group
        const teacher = await Teacher.findById(teacherId).select('isSupervisorOf');
        
        if (!teacher || !teacher.isSupervisorOf) {
            return res.status(403).json({
                success: false,
                message: "No group assigned to this supervisor"
            });
        }

        const groupId = teacher.isSupervisorOf;

        // 3. Get FYP Team evaluations for this group
        const evaluations = await Evaluation.find({
            groupId,
            evaluatorType: "FYPTeam"
        })
        .populate('studentId', 'name rollNumber')
        .populate('createdBy', 'name');

        // 4. Format response
        res.status(200).json({
            success: true,
            data: {
                groupId,
                evaluations: evaluations.map(eval => ({
                    studentId: eval.studentId._id,
                    rollNumber: eval.rollNumber,
                    studentName: eval.studentId?.name,
                    evaluatedBy: eval.createdBy?.name || "FYP Committee",
                    midYear: eval.midYearEvaluation.completed ? {
                        marks: eval.midYearEvaluation.marks,
                        evaluatedAt: eval.midYearEvaluation.evaluatedAt
                    } : null,
                    finalYear: eval.finalYearEvaluation.completed ? {
                        marks: eval.finalYearEvaluation.marks,
                        evaluatedAt: eval.finalYearEvaluation.evaluatedAt
                    } : null
                }))
            }
        });

    } catch (error) {
        console.error("Error fetching FYP evaluations:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getSupervisorEvaluations = async (req, res) => {
    try {
        // 1. Get supervisor's assigned group from token
        const teacher = await Teacher.findById(req.user.id).select('isSupervisorOf');
        
        if (!teacher || !teacher.isSupervisorOf) {
            return res.status(403).json({
                success: false,
                message: "No group assigned to this supervisor"
            });
        }

        const groupId = teacher.isSupervisorOf;

        // 2. Get all supervisor evaluations (both MidYear and FinalYear)
        const evaluations = await Evaluation.find({
            groupId,
            evaluatorType: "Supervisor",
            createdBy: req.user.id,
            $or: [
                { 'midYearEvaluation.completed': true },
                { 'finalYearEvaluation.completed': true }
            ]
        })
        .populate('studentId', 'name rollNumber')
        .sort({ updatedAt: -1 });

        // 3. Format response to include both evaluation types
        const formattedEvaluations = evaluations.flatMap(eval => {
            const results = [];
            
            if (eval.midYearEvaluation.completed) {
                results.push({
                    studentId: eval.studentId._id,
                    rollNumber: eval.rollNumber,
                    studentName: eval.studentId?.name,
                    evaluationType: "MidYear",
                    marks: eval.midYearEvaluation.marks,
                    evaluatedAt: eval.midYearEvaluation.evaluatedAt,
                    lastUpdated: eval.updatedAt
                });
            }
            
            if (eval.finalYearEvaluation.completed) {
                results.push({
                    studentId: eval.studentId._id,
                    rollNumber: eval.rollNumber,
                    studentName: eval.studentId?.name,
                    evaluationType: "FinalYear",
                    marks: eval.finalYearEvaluation.marks,
                    evaluatedAt: eval.finalYearEvaluation.evaluatedAt,
                    lastUpdated: eval.updatedAt
                });
            }
            
            return results;
        });

        res.status(200).json({
            success: true,
            data: {
                groupId,
                evaluations: formattedEvaluations
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getStudentCombinedMarks = async (req, res) => {
    try {
        // Get student details from token
        const { id: studentId, rollNumber, name, groupID: groupId } = req.user;

        // Get all evaluations for this student
        const evaluations = await Evaluation.find({
            studentId,
            $or: [
                { 'midYearEvaluation.completed': true },
                { 'finalYearEvaluation.completed': true }
            ]
        });

        // Check if both evaluators have completed each evaluation type
        const hasBothMidYear = evaluations.filter(e => 
            e.midYearEvaluation.completed
        ).length === 2; // Both FYP and Supervisor

        const hasBothFinalYear = evaluations.filter(e => 
            e.finalYearEvaluation.completed
        ).length === 2; // Both FYP and Supervisor

        // Calculate combined marks only if both evaluators have completed
        const getCombinedMarks = (type) => {
            if ((type === 'midYear' && !hasBothMidYear) || 
                (type === 'finalYear' && !hasBothFinalYear)) {
                return null;
            }

            return evaluations.reduce((acc, eval) => {
                if (eval[`${type}Evaluation`]?.completed) {
                    const marks = eval[`${type}Evaluation`].marks;
                    return {
                        ...(type === 'midYear' ? {
                            presentation: (acc.presentation || 0) + (marks.presentation || 0),
                            srsReport: (acc.srsReport || 0) + (marks.srsReport || 0),
                            poster: (acc.poster || 0) + (marks.poster || 0),
                            progressSheet: (acc.progressSheet || 0) + (marks.progressSheet || 0)
                        } : {
                            report: (acc.report || 0) + (marks.report || 0),
                            finalPresentation: (acc.finalPresentation || 0) + (marks.finalPresentation || 0)
                        }),
                        total: (acc.total || 0) + (marks.total || 0)
                    };
                }
                return acc;
            }, {});
        };

        // Format response
        const response = {
            studentId,
            groupId,
            marks: {
                midYear: hasBothMidYear ? { 
                    marks: getCombinedMarks('midYear'),
                    message: "Both evaluations complete"
                } : {
                    message: "Evaluation is incomplete. Marks are pending from either the Supervisor or the FYP Committee."
                },
                finalYear: hasBothFinalYear ? { 
                    marks: getCombinedMarks('finalYear'),
                    message: "Both evaluations complete"
                } : {
                    message: "Evaluation is incomplete. Marks are pending from either the Supervisor or the FYP Committee."
                }
            }
        };

        res.status(200).json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error("Error in getStudentCombinedMarks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch combined marks"
        });
    }
};

module.exports = {
    getEligibleGroups,
    getGroupEvaluations,
    getStudentEvaluation,
    saveEvaluation,
    getSupervisorEvaluationsForFYP,
    getSupervisorGroups,
    saveSupervisorEvaluation,
    getGroupFypEvaluations,
    getSupervisorEvaluations,
    getStudentCombinedMarks
};