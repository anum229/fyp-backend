const express = require('express');
const router = express.Router();
const {
    getEligibleGroups,
    getGroupEvaluations,
    getStudentEvaluation,
    saveEvaluation,
    getSupervisorGroups,
    saveSupervisorEvaluation,
    getGroupFypEvaluations,
    getSupervisorEvaluationsForFYP,
    getSupervisorEvaluations,
    getStudentCombinedMarks
} = require('../controllers/evaluationController');
const {     verifyToken, verifyFYPTeam, verifyTeacherRole, verifyStudentRole  } = require('../middleware/authMiddleware');

//Get Evaluation Marks by Student
router.get('/student/combined-marks', verifyToken, verifyStudentRole, getStudentCombinedMarks);

// FYP Team protected routes
router.get('/', verifyToken, verifyFYPTeam, getEligibleGroups);
router.get('/group/:groupId', verifyToken, verifyFYPTeam, getGroupEvaluations);
router.get('/student/:rollNumber', verifyToken, verifyFYPTeam, getStudentEvaluation);
router.post('/', verifyToken, verifyFYPTeam, saveEvaluation);
router.get('/fyp/supervisor-evaluations/:groupId', verifyToken, verifyFYPTeam, getSupervisorEvaluationsForFYP);

// Supervisor (Teacher) Protected Routes
router.get('/supervisor/groups', verifyToken, verifyTeacherRole, getSupervisorGroups);
router.post('/supervisor/evaluate', verifyToken, verifyTeacherRole, saveSupervisorEvaluation);
router.get('/supervisor/fyp-evaluations', verifyToken, verifyTeacherRole, getGroupFypEvaluations);
router.get('/supervisor/my-evaluations', verifyToken, verifyTeacherRole, getSupervisorEvaluations);

module.exports = router;