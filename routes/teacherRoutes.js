const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { verifyToken, verifyFYPTeam, verifyTeacherRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Teacher Routes
router.get('/dashboard/upcoming', verifyToken, verifyTeacherRole, teacherController.getTeacherDashboardData);
router.post('/register', verifyFYPTeam, teacherController.registerTeacher); // Only FYP Team can create
router.post('/bulk-upload', verifyFYPTeam, upload.single('file'), teacherController.bulkUploadTeachers);
router.get('/', verifyFYPTeam, teacherController.getAllTeachers); // Only FYP Team can access
router.get(
    '/supervising-group-leader-email',
    verifyTeacherRole,
    teacherController.getSupervisingGroupLeaderEmail
  );
router.get('/my-groups', verifyTeacherRole, teacherController.getTeacherGroups);
// Education & Expertise routes
router.get('/education-expertise/me', verifyTeacherRole, teacherController.getTeacherEducationExpertise);
router.put('/education-expertise/me', verifyTeacherRole, teacherController.updateTeacherEducationExpertise);
router.get('/education-expertise/options', verifyToken, teacherController.getExpertiseOptions);
router.get('/education-expertise/fields-of-study', verifyToken, teacherController.getFieldsOfStudyOptions);

router.get('/education-expertise/:id', verifyFYPTeam, teacherController.getTeacherEducationExpertiseById);

router.get('/:id', verifyToken, teacherController.getTeacherById); // Only FYP Team can access
router.put('/:id', verifyFYPTeam, teacherController.updateTeacher); // Only FYP Team can update
router.delete('/:id', verifyFYPTeam, teacherController.deleteTeacher); // Only FYP Team can delete

module.exports = router;