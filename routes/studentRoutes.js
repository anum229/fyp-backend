const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken, verifyFYPTeam, verifyStudentRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Public routes (if any) would go here

// FYP Team protected routes
router.post('/register', verifyFYPTeam, studentController.registerStudent);
router.post('/bulk-upload', verifyFYPTeam, upload.single('file'), studentController.bulkUploadStudents);
router.get('/', verifyFYPTeam, studentController.getAllStudents);
router.put('/:id', verifyFYPTeam, studentController.updateStudent);
router.delete('/:id', verifyFYPTeam, studentController.deleteStudent);

// Student protected routes
router.get('/dashboard/upcoming', verifyToken, verifyStudentRole, studentController.getStudentDashboardData);
router.get('/groupleader', verifyToken, studentController.getGroupLeaderByGroupID);

// Shared protected routes (both FYP Team and Student can access)
router.get('/:id', verifyToken, studentController.getStudentById);

module.exports = router;