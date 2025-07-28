const express = require('express');
const router = express.Router();
const {
  getAvailableVenues,
  getEligibleGroups,
  checkVenueAvailability,
  scheduleMeeting,
  getScheduledMeetings,
  getSupervisorGroupsForMeeting
} = require('../controllers/meetingController');
const { verifyToken, verifyFYPTeam, verifyTeacherRole } = require('../middleware/authMiddleware');

// --------------------------
// Middleware to allow FYP Team OR Teacher
// --------------------------
const verifyFYPOrTeacher = (req, res, next) => {
  if (req.user.role === 'fyp_team' || req.user.role === 'teacher') {
    next();
  } else {
    res.status(403).json({ 
      success: false,
      message: "Access restricted to FYP Team and Teachers" 
    });
  }
};

// --------------------------
// FYP Team Exclusive Routes
// --------------------------
router.get('/eligible-groups', verifyToken, verifyFYPTeam, getEligibleGroups);
router.post('/fyp-schedule', verifyToken, verifyFYPTeam, scheduleMeeting);

// --------------------------
// Teacher Exclusive Routes
// --------------------------
router.get('/supervisor/groups', verifyToken, verifyTeacherRole, getSupervisorGroupsForMeeting);
router.post('/supervisor-schedule', verifyToken, verifyTeacherRole, scheduleMeeting);

// --------------------------
// Shared Routes (FYP Team + Teachers)
// --------------------------
router.get('/venues', verifyToken, verifyFYPOrTeacher, getAvailableVenues);
router.post('/check-availability', verifyToken, verifyFYPOrTeacher, checkVenueAvailability);

// --------------------------
// General Access Routes
// --------------------------
router.get('/', verifyToken, getScheduledMeetings);

module.exports = router;