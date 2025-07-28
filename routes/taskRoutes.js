const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const taskController = require('../controllers/taskController');
const { verifyToken, verifyTeacherRole, verifyStudentRole } = require('../middleware/authMiddleware');

// 1. Create a task (teacher)
router.post('/create', verifyToken, verifyTeacherRole, taskController.createTask);

// 2. Get all tasks assigned by the teacher
router.get('/by-teacher', verifyToken, verifyTeacherRole, taskController.getTasksByTeacher);

// 3. Get all tasks assigned to the student
router.get('/my-tasks', verifyToken, verifyStudentRole, taskController.getTasksForStudent);

// 4. Submit task (student)
router.post('/submit/:taskId', verifyToken, verifyStudentRole, upload.single('file'), taskController.submitTask);

// 5. Get pending tasks created by teacher (for Created Tasks page)
router.get('/created-tasks', verifyToken, verifyTeacherRole, taskController.getCreatedTasksByTeacher);

// 6. Get submitted tasks created by teacher (for Student Submissions page)
router.get('/student-submissions', verifyToken, verifyTeacherRole, taskController.getStudentSubmissionsByTeacher);

// 7. Edit a task (teacher)
router.put('/edit/:taskId', verifyToken, verifyTeacherRole, taskController.editTask);

// 8. Delete a task (teacher)
router.delete('/delete/:taskId', verifyToken, verifyTeacherRole, taskController.deleteTask);

// 9. Get Pending Tasks for Logged-in Student
router.get('/pending-tasks', verifyToken, verifyStudentRole, taskController.getPendingTasks);

// 10. Get Completed Tasks for Logged-in Student
router.get('/completed-tasks', verifyToken, verifyStudentRole, taskController.getCompletedTasks);

module.exports = router;