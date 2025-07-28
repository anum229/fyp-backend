const mongoose = require('mongoose'); 
const Meeting = require("../models/Meeting");
const Proposal = require("../models/Proposal");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { sendMeetingNotification } = require("../services/notificationService");

// Hardcoded venues (can be moved to config file if needed)
const AVAILABLE_VENUES = [
  "AT-01", "BT-15", "BT-14",
  "Lab-5", "Conference-Room-A"
];

// [NEW API] Get all available venues
const getAvailableVenues = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: AVAILABLE_VENUES
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching available venues"
    });
  }
};

// Get all eligible groups (approved with supervisor) - FYP Team only
const getEligibleGroups = async (req, res) => {
    try {
        // 1. Get only proposals with assigned teachers (explicit null check)
        const proposals = await Proposal.find({ 
            fypStatus: "Approved",
            assigned_teacher: { $exists: true, $ne: null }
        })
        .populate("assigned_teacher", "name email")
        .populate("assigned_coadvisor", "name email")
        .populate("submittedBy", "name rollNumber")
        .lean();

        if (proposals.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No eligible groups found"
            });
        }

        // 2. Populate group members with student details
        const populatedGroups = await Promise.all(proposals.map(async proposal => {
            const students = await Student.find({
                rollNumber: { $in: proposal.groupMembers }
            }).select("name rollNumber -_id");
            
            // Verify all members exist
            if (students.length !== proposal.groupMembers.length) {
                console.warn(`Missing members in group ${proposal.groupId}:`, 
                    proposal.groupMembers.filter(r => !students.some(s => s.rollNumber === r)));
            }
            
            return {
                ...proposal,
                groupMembers: students,
                assignedTeacher: proposal.assigned_teacher,
                coAdvisor: proposal.assigned_coadvisor || null
            };
        }));

        res.status(200).json({
            success: true,
            data: populatedGroups
        });
    } catch (error) {
        console.error("Error in getEligibleGroups:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch groups: " + error.message
        });
    }
};

// Get groups assigned to supervisor - Teacher only
const getSupervisorGroupsForMeeting = async (req, res) => {
    try {
        // Get only approved groups where current user is supervisor
        const proposals = await Proposal.find({
            assigned_teacher: req.user.id,
            fypStatus: "Approved"
        })
        .populate("assigned_teacher", "name email")
        .populate("assigned_coadvisor", "name email")
        .lean();

        if (proposals.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No groups assigned to you"
            });
        }

        // Populate group members with student details
        const populatedGroups = await Promise.all(proposals.map(async proposal => {
            const students = await Student.find({
                rollNumber: { $in: proposal.groupMembers }
            }).select("name rollNumber -_id");
            
            return {
                ...proposal,
                groupMembers: students,
                assignedTeacher: proposal.assigned_teacher,
                coAdvisor: proposal.assigned_coadvisor || null
            };
        }));

        res.status(200).json({
            success: true,
            data: populatedGroups
        });
    } catch (error) {
        console.error("Error in getSupervisorGroupsForMeeting:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch your groups: " + error.message
        });
    }
};

// Check venue availability - Available to both FYP Team and Teachers
const checkVenueAvailability = async (req, res) => {
    try {
        const { venue, startTime, endTime, excludeMeetingId } = req.body;
        
        // Validate venue exists
        if (!AVAILABLE_VENUES.includes(venue)) {
            return res.status(400).json({
                success: false,
                message: "Invalid venue provided"
            });
        }

        const overlappingMeetings = await Meeting.find({
            venue,
            $or: [
                { startTime: { $lt: endTime, $gte: startTime } },
                { endTime: { $gt: startTime, $lte: endTime } },
                { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
            ],
            _id: { $ne: excludeMeetingId }
        });

        res.status(200).json({
            available: overlappingMeetings.length === 0,
            conflictingMeetings: overlappingMeetings
        });
    } catch (error) {
        console.error("Error in checkVenueAvailability:", error);
        res.status(500).json({
            success: false,
            message: "Error checking venue availability"
        });
    }
};

// Schedule a new meeting - Handles both FYP Team and Supervisor cases
const scheduleMeeting = async (req, res) => {
    try {
        // 1. Validate input
        const { groupId, venue, startTime, endTime } = req.body;
        if (!groupId || !venue || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                required: ["groupId", "venue", "startTime", "endTime"]
            });
        }

        // 2. Validate time format
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format",
                example: "2025-06-20T10:00:00Z"
            });
        }

        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: "End time must be after start time"
            });
        }

        // 3. Validate venue
        if (!AVAILABLE_VENUES.includes(venue)) {
            return res.status(400).json({
                success: false,
                message: "Invalid venue",
                availableVenues: AVAILABLE_VENUES
            });
        }

        // 4. Find proposal and verify permissions
        const proposal = await Proposal.findOne({
            groupId,
            fypStatus: "Approved",
            assigned_teacher: { $exists: true }
        }).lean();

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: "No eligible proposal found"
            });
        }

        // Check if user is authorized (FYP team or assigned supervisor)
        const isFYPTeam = req.user.role === 'fyp_team';
        const isSupervisor = proposal.assigned_teacher.toString() === req.user.id;
        
        if (!isFYPTeam && !isSupervisor) {
            return res.status(403).json({
                success: false,
                message: "Only FYP team or assigned supervisor can schedule meetings"
            });
        }

        // 5. Find students
        const students = await Student.find({
            rollNumber: { $in: proposal.groupMembers }
        }).select("_id name rollNumber");

        if (students.length !== proposal.groupMembers.length) {
            return res.status(404).json({
                success: false,
                message: "Some group members not found",
                missingMembers: proposal.groupMembers.filter(
                    roll => !students.some(s => s.rollNumber === roll)
                )
            });
        }

        // 6. Check venue conflicts
        const conflict = await Meeting.findOne({
            venue,
            $or: [
                { startTime: { $lt: end, $gte: start }},
                { endTime: { $gt: start, $lte: end }},
                { startTime: { $lte: start }, endTime: { $gte: end }}
            ]
        });

        if (conflict) {
            return res.status(409).json({
                success: false,
                message: "Venue already booked",
                conflict: {
                    groupId: conflict.groupId,
                    timeRange: `${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`
                }
            });
        }

        // 7. Create meeting with appropriate participants
        const meetingData = {
            groupId,
            projectTitle: proposal.projectTitle,
            venue,
            startTime: start,
            endTime: end,
            participants: {
                students: students.map(s => s._id),
                supervisor: proposal.assigned_teacher,
                coAdvisor: isFYPTeam ? proposal.assigned_coadvisor : null
            },
            createdBy: req.user.id,
            status: "Scheduled"
        };

        const meeting = new Meeting(meetingData);
        await meeting.save();

        // 8. Send notification (async)
        sendMeetingNotification(meeting).catch(err => {
            console.error("Notification failed:", err);
        });

        // 9. Prepare response with populated data
        const teacher = await Teacher.findById(proposal.assigned_teacher).select("name email");
        const coAdvisor = isFYPTeam && proposal.assigned_coadvisor 
            ? await Teacher.findById(proposal.assigned_coadvisor).select("name email")
            : null;

        const response = {
            ...meeting.toObject(),
            participants: {
                students: students.map(s => ({
                    _id: s._id,
                    name: s.name,
                    rollNumber: s.rollNumber
                })),
                supervisor: {
                    _id: proposal.assigned_teacher,
                    name: teacher.name,
                    email: teacher.email
                },
                coAdvisor: coAdvisor ? {
                    _id: coAdvisor._id,
                    name: coAdvisor.name,
                    email: coAdvisor.email
                } : null
            }
        };

        return res.status(201).json({
            success: true,
            message: "Meeting scheduled successfully",
            data: response
        });

    } catch (error) {
        console.error("Error in scheduleMeeting:", error);
        return res.status(500).json({
            success: false,
            message: "Meeting scheduling failed",
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
};

// Get all scheduled meetings - Available to all authenticated users
const getScheduledMeetings = async (req, res) => {
    try {
        let query = { status: "Scheduled" };
        
        // If user is a teacher, only show meetings where they are supervisor/co-advisor
        if (req.user.role === 'teacher') {
            query.$or = [
                { "participants.supervisor": req.user.id },
                { "participants.coAdvisor": req.user.id }
            ];
        }
        // If user is a student, only show meetings where they are participants
        else if (req.user.role === 'student') {
            query["participants.students"] = req.user.id;
        }

        const meetings = await Meeting.find(query)
            .populate("participants.students", "name rollNumber")
            .populate("participants.supervisor", "name email")
            .populate("participants.coAdvisor", "name email")
            .populate("createdBy", "name email")
            .sort({ startTime: 1 });

        res.status(200).json({
            success: true,
            data: meetings
        });
    } catch (error) {
        console.error("Error in getScheduledMeetings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching meetings"
        });
    }
};

module.exports = {
    getAvailableVenues,
    getEligibleGroups,
    getSupervisorGroupsForMeeting,
    checkVenueAvailability,
    scheduleMeeting,
    getScheduledMeetings
};