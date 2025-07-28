const Task = require('../models/Task');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const cloudinary = require('../config/cloudinary');
const { ObjectId } = require('mongoose').Types;

// Helper function to convert local date to UTC
const localToUTC = (localDate) => {
  const date = new Date(localDate);
  return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
};

// Helper function to convert UTC to local date
const utcToLocal = (utcDate) => {
  const date = new Date(utcDate);
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
};

// 1. Create a new Task (Teacher)
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedToRollNumber, dueDate } = req.body;

    if (!assignedToRollNumber) {
      return res.status(400).json({ message: "Student roll number is required." });
    }

    // Get student by roll number
    const student = await Student.findOne({ rollNumber: assignedToRollNumber });

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    if (!student.groupID || student.groupID.trim() === "") {
      return res.status(400).json({ message: "This student is not assigned to any group." });
    }

    // Get teacher record
    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return res.status(403).json({ message: "Teacher not found or unauthorized." });
    }

    // Compare groupIDs directly as strings
    if (student.groupID !== teacher.isSupervisorOf) {
      return res.status(403).json({
        message: `You can only assign tasks to your supervised group. This student is in group ${student.groupID}, but you supervise group ${teacher.isSupervisorOf}.`,
      });
    }

    // Convert dueDate from local time to UTC
    const utcDueDate = localToUTC(new Date(dueDate));

    // Create task
    const task = new Task({
      title,
      description,
      assignedBy: req.user.id,
      assignedTo: student._id,
      dueDate: utcDueDate,
    });

    await task.save();
    
    // Convert dates to local time for response
    const responseTask = task.toObject();
    responseTask.dueDate = utcToLocal(task.dueDate);
    responseTask.assignedDate = utcToLocal(task.assignedDate);
    
    res.status(201).json({ 
      message: "Task created successfully", 
      task: responseTask 
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 2. Get all tasks assigned by a teacher
exports.getTasksByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const tasks = await Task.find({ assignedBy: teacherId }).populate('assignedTo', 'rollNumber name');
    res.status(200).json(tasks);
  } catch (err) {
    console.error("Error fetching teacher tasks:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// 3. Get all tasks assigned to a student
exports.getTasksForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;

    const tasks = await Task.find({ assignedTo: studentId });
    res.status(200).json(tasks);
  } catch (err) {
    console.error("Error fetching student tasks:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// 4. Student submits a task (with file + description)
exports.submitTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { studentDescription } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // First find the task to check its status and due date
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if task is already submitted
    if (task.status !== 'Pending') {
      return res.status(400).json({ 
        message: `Cannot submit task - current status is '${task.status}'` 
      });
    }

    // Compare dates - Add 5 hours to current time for PKT comparison only
    const currentTime = new Date();
    currentTime.setHours(currentTime.getHours() + 5); // Add 5 hours for PKT
    const dueDateLocal = utcToLocal(task.dueDate);

    if (currentTime > dueDateLocal) {
      return res.status(400).json({ 
        message: 'Task submission is past the due date and cannot be submitted',
        dueDate: dueDateLocal.toISOString(),
        currentTime: currentTime.toISOString(),
        timezone: 'Asia/Karachi'
      });
    }

    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(file.path, {
      resource_type: 'raw',
      folder: 'task_submissions'
    });

    // Update the task (store actual UTC time, not adjusted time)
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      {
        status: 'Submitted',
        submissionDate: new Date(), // Store actual server time in UTC
        submittedFile: result.secure_url,
        studentDescription
      },
      { new: true }
    );

    // Convert dates to local time for response
    const responseTask = updatedTask.toObject();
    responseTask.dueDate = utcToLocal(updatedTask.dueDate);
    responseTask.assignedDate = utcToLocal(updatedTask.assignedDate);
    responseTask.submissionDate = utcToLocal(updatedTask.submissionDate);

    res.status(200).json({
      message: 'Task submitted successfully',
      task: responseTask
    });

  } catch (err) {
    console.error("Error submitting task:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// 5. Get pending tasks created by teacher
exports.getCreatedTasksByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const tasks = await Task.find({
      assignedBy: teacherId,
      status: 'Pending'
    }).populate('assignedTo', 'name rollNumber');

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching created tasks:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 6. Get submitted/non-pending tasks created by teacher
exports.getStudentSubmissionsByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const tasks = await Task.find({
      assignedBy: teacherId,
      status: { $ne: 'Pending' }
    }).populate('assignedTo', 'name rollNumber');

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching student submissions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//7. Edit Task (Only if status is "Pending")
exports.editTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, dueDate, assignedToRollNumber } = req.body;

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(403).json({ message: "Teacher not found or unauthorized." });
    }

    let task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Allow edit only if task status is Pending
    if (task.status !== 'Pending') {
      return res.status(403).json({ message: "Only tasks with status 'Pending' can be edited." });
    }

    let updatedFields = {
      title,
      description,
      dueDate,
    };

    // If roll number is being updated, validate and assign
    if (assignedToRollNumber) {
      const student = await Student.findOne({ rollNumber: assignedToRollNumber });

      if (!student) {
        return res.status(404).json({ message: "Student not found." });
      }

      if (!student.groupID || student.groupID !== teacher.isSupervisorOf) {
        return res.status(403).json({
          message: `You can only assign tasks to your supervised group. This student is in group ${student.groupID}, but you supervise group ${teacher.isSupervisorOf}.`
        });
      }

      updatedFields.assignedTo = student._id;
    }

    task = await Task.findByIdAndUpdate(taskId, updatedFields, { new: true });

    res.status(200).json({ message: "Task updated successfully", task });
  } catch (error) {
    console.error("Error editing task:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//8. Delete Task (Only if status is "Pending")
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(403).json({ message: "Teacher not found or unauthorized." });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Allow delete only if task status is Pending
    if (task.status !== 'Pending') {
      return res.status(403).json({ message: "Only tasks with status 'Pending' can be deleted." });
    }

    await Task.findByIdAndDelete(taskId);
    res.status(200).json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 9. Get Pending Tasks for Logged-in Student
exports.getPendingTasks = async (req, res) => {
    try {
        const studentId = req.user.id; // Get student ID from token
        const tasks = await Task.find({ assignedTo: studentId, status: 'Pending' });

        res.status(200).json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// 10. Get Non-Pending Tasks for Logged-in Student
exports.getCompletedTasks = async (req, res) => {
    try {
        const studentId = req.user.id; // Get student ID from token

        const tasks = await Task.find({
            assignedTo: studentId,
            status: { $ne: 'Pending' }  // Not equal to 'Pending'
        });

        res.status(200).json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};