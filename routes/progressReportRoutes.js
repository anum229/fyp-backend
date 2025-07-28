const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const progressReportController = require('../controllers/progressReportController');
const { verifyToken, verifyTeacherRole, verifyStudentRole, verifyFYPTeam } = require('../middleware/authMiddleware');

// Teacher routes
router.post('/submit', 
  verifyToken, 
  verifyTeacherRole, 
  upload.single('file'), 
  progressReportController.submitProgressReport
);

router.get('/teacher', 
  verifyToken, 
  verifyTeacherRole, 
  progressReportController.getTeacherProgressReports
);

router.put('/:reportId', 
  verifyToken, 
  verifyTeacherRole, 
  upload.single('file'), 
  progressReportController.updateProgressReport
);

router.delete('/:reportId', 
  verifyToken, 
  verifyTeacherRole, 
  progressReportController.deleteProgressReport
);

// Student route
router.get('/student', 
  verifyToken, 
  verifyStudentRole, 
  progressReportController.getStudentProgressReports
);

// ✅ FYP Team route
router.get('/all', 
  verifyToken, 
  verifyFYPTeam, 
  progressReportController.getAllProgressReports
);

module.exports = router;