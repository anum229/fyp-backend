const Student = require('../models/Student');
const bcrypt = require('bcryptjs');
const EventsAndCompetitions = require('../models/Event');
const Task = require('../models/Task');
const Meeting = require('../models/Meeting');
const jwt = require('jsonwebtoken');
const csv = require('csv-parser');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');
const validator = require('validator');
const Proposal = require('../models/Proposal');
const Evaluation = require('../models/Evaluation');

exports.bulkUploadStudents = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Cloudinary Upload (Optional)
        const cloudinaryUpload = await new Promise((resolve) => {
            cloudinary.uploader.upload_stream(
                { resource_type: 'raw', folder: 'student-uploads' },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        resolve(null);
                    } else {
                        resolve(result);
                    }
                }
            ).end(req.file.buffer);
        });

        const results = [];
        const errors = [];
        let processedCount = 0;

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        const groupMap = {}; // Track groupID → { count, hasLeader }

        // Step 1: Load all existing students grouped by groupID
        const existingStudents = await Student.find({}, 'groupID student_role');
        for (const student of existingStudents) {
            const gid = student.groupID;
            if (!gid) continue;

            if (!groupMap[gid]) {
                groupMap[gid] = { count: 0, hasLeader: false };
            }

            groupMap[gid].count += 1;
            if (student.student_role === 'Group Leader') {
                groupMap[gid].hasLeader = true;
            }
        }

        // Step 2: Process CSV rows
        const stream = Readable.from(req.file.buffer)
            .pipe(csv())
            .on('data', (data) => {
                processedCount++;
                try {
                    const row = processedCount;

                    const {
                        name,
                        rollNumber,
                        email,
                        groupID = '',
                        department = '',
                        batch = '',
                        student_role = 'Member',
                        password
                    } = data;

                    // Required fields
                    if (!name || !rollNumber || !email || !password) {
                        errors.push({ row, error: 'Missing required fields', data });
                        return;
                    }

                    // Email format
                    if (!validator.isEmail(email)) {
                        errors.push({ row, error: 'Invalid email format', data });
                        return;
                    }

                    // Password strength
                    if (!strongPasswordRegex.test(password)) {
                        errors.push({
                            row,
                            error: 'Weak password. Must include uppercase, lowercase, number, special character, and be 8+ chars.',
                            data
                        });
                        return;
                    }

                    // Group constraints
                    if (groupID) {
                        if (!groupMap[groupID]) {
                            groupMap[groupID] = { count: 0, hasLeader: false };
                        }

                        // Check group size
                        if (groupMap[groupID].count >= 4) {
                            errors.push({
                                row,
                                error: `Group ${groupID} cannot have more than 4 members`,
                                data
                            });
                            return;
                        }

                        // Check for duplicate group leader
                        if (student_role === 'Group Leader' && groupMap[groupID].hasLeader) {
                            errors.push({
                                row,
                                error: `Group ${groupID} already has a Group Leader`,
                                data
                            });
                            return;
                        }

                        // Update temp group state
                        groupMap[groupID].count++;
                        if (student_role === 'Group Leader') {
                            groupMap[groupID].hasLeader = true;
                        }
                    }

                    results.push({
                        name,
                        rollNumber,
                        email,
                        groupID,
                        department,
                        batch,
                        student_role,
                        password
                    });

                } catch (error) {
                    errors.push({ row: processedCount, error: error.message, data });
                }
            });

        await new Promise((resolve) => stream.on('end', resolve));

        let successCount = 0;

        for (const studentData of results) {
            try {
                const exists = await Student.findOne({
                    $or: [{ email: studentData.email }, { rollNumber: studentData.rollNumber }]
                });

                if (exists) {
                    errors.push({
                        row: results.indexOf(studentData) + 1,
                        error: 'Student with this email or roll number already exists',
                        data: studentData
                    });
                    continue;
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(studentData.password, salt);

                const student = new Student({
                    ...studentData,
                    password: hashedPassword,
                    user_role: 'student'
                });

                await student.save();

                if (student.groupID) {
                    try {
                        const proposal = await Proposal.findOne({ groupId: String(student.groupID) });
                        if (proposal) {
                            const allGroupMembers = await Student.find({ groupID: student.groupID }).select('rollNumber -_id').lean();
                            const rollNumbers = allGroupMembers.map(m => m.rollNumber).filter(Boolean);

                            proposal.groupMembers = rollNumbers;
                            await proposal.save();
                        }
                    } catch (syncError) {
                        console.error(`Error syncing proposal groupMembers for groupID ${student.groupID}:`, syncError);
                    }
                }

                successCount++;
            } catch (error) {
                errors.push({
                    row: results.indexOf(studentData) + 1,
                    error: error.message,
                    data: studentData
                });
            }
        }

        res.status(200).json({
            message: 'Bulk upload completed',
            cloudinary_url: cloudinaryUpload?.secure_url,
            total: processedCount,
            success: successCount,
            errors: errors.length,
            errorDetails: errors
        });

    } catch (error) {
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};

// Register Student
exports.registerStudent = async (req, res) => {
    try {
        const { name, rollNumber, email, groupID, department, batch, student_role, password } = req.body;

        // ======= Email Format Validation =======
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // ======= Strong Password Validation =======
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character'
            });
        }

        // ======= Check if student already exists =======
        let existingStudent = await Student.findOne({ $or: [{ email }, { rollNumber }] });
        if (existingStudent) {
            return res.status(400).json({ message: 'Student with this email or roll number already exists' });
        }

        // ======= Group Validation =======
        if (groupID) {
            const groupMembers = await Student.find({ groupID });

            // Max 4 students
            if (groupMembers.length >= 4) {
                return res.status(400).json({ message: 'A group cannot have more than 4 students' });
            }

            // Only 1 Group Leader allowed
            if (student_role === 'Group Leader') {
                const alreadyLeader = groupMembers.find(member => member.student_role === 'Group Leader');
                if (alreadyLeader) {
                    return res.status(400).json({ message: 'This group already has a Group Leader' });
                }
            }
        }

        // ======= Hash password =======
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // ======= Create new student =======
        const student = new Student({
            name,
            rollNumber,
            email,
            groupID,
            department,
            batch,
            student_role,
            password: hashedPassword
        });

        await student.save();

try {
    const proposal = await Proposal.findOne({ groupId: String(groupID) });

    if (!proposal) {
        console.warn("No proposal found for groupID:", groupID);
    } else {
        const allGroupMembers = await Student.find({ groupID }).select('rollNumber -_id').lean();

        const rollNumbers = allGroupMembers
            .map(m => m.rollNumber)
            .filter(Boolean); // Remove null/undefined

        console.log("Updating proposal groupMembers to:", rollNumbers);

        proposal.groupMembers = rollNumbers;

        await proposal.save(); // if this fails, error will be caught below
    }
} catch (saveError) {
    console.error("Error updating proposal groupMembers:", saveError.message, saveError);
    return res.status(500).json({
        message: "Failed to update proposal group members",
        error: saveError.message || saveError
    });
}

        res.status(201).json({ message: 'Student registered successfully' });

    } catch (error) {
        console.error("Error in registerStudent:", error); // log detailed error
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email or Roll Number must be unique' });
        }
        res.status(500).json({ message: 'Server Error', error });
    }
};

// Get All Students (Exclude Password)
exports.getAllStudents = async (req, res) => {
    try {
        const students = await Student.find().select("-password"); // Exclude password
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// Get Student by ID (Exclude Password)
exports.getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).select("-password"); // Exclude password
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// Update Student
exports.updateStudent = async (req, res) => {
    try {
        const { password, email, groupID, student_role, ...updateData } = req.body;

        let student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const oldGroupID = student.groupID;

        // ====== Email Format Validation ======
        if (email && !validator.isEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // ====== Password Strength Validation ======
        if (password) {
            const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!strongPasswordRegex.test(password)) {
                return res.status(400).json({
                    message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character'
                });
            }

            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const newGroupID = groupID !== undefined ? groupID : student.groupID;
        const newRole = student_role || student.student_role;

// ❌ Prevent groupID change if any evaluation exists for this student
if (groupID && oldGroupID !== groupID) {
    const existingEvaluations = await Evaluation.findOne({ studentId: student._id });
    if (existingEvaluations) {
        return res.status(400).json({
            message: 'Cannot change group ID because evaluations already exist for this student'
        });
    }
}


        // ====== Group Validations ======
        if (groupID !== undefined || student_role) {
            const groupMembers = await Student.find({
                groupID: newGroupID,
                _id: { $ne: student._id }
            });

            if (groupID && groupMembers.length >= 4) {
                return res.status(400).json({ message: 'A group cannot have more than 4 students' });
            }

            if (newRole === 'Group Leader') {
                const existingLeader = groupMembers.find(member => member.student_role === 'Group Leader');
                if (existingLeader) {
                    return res.status(400).json({ message: 'This group already has a Group Leader' });
                }
            }
        }

        // ====== Prepare Update Payload ======
        const updatePayload = {
            ...updateData,
            ...(email && { email }),
            ...(student_role && { student_role }),
            ...(groupID !== undefined ? { groupID } : {})  // Allow setting to null explicitly
        };

        const updatedStudent = await Student.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            {
                new: true,
                runValidators: true
            }
        ).select("-password");

        // ====== Sync Proposal groupMembers ======
        try {
            // ✅ Remove from old proposal if moved or removed from group
            if ((groupID !== undefined) && oldGroupID && oldGroupID !== groupID) {
                const oldProposal = await Proposal.findOne({ groupId: String(oldGroupID) });
                if (oldProposal) {
                    oldProposal.groupMembers = oldProposal.groupMembers.filter(r => r !== student.rollNumber);
                    await oldProposal.save();
                }
            }

            // ✅ Add to new group proposal if new group is assigned
            if (groupID) {
                const newProposal = await Proposal.findOne({ groupId: String(groupID) });
                if (newProposal) {
                    const groupStudents = await Student.find({ groupID }).select('rollNumber -_id').lean();
                    newProposal.groupMembers = groupStudents.map(m => m.rollNumber).filter(Boolean);
                    await newProposal.save();
                }
            }

        } catch (syncError) {
            console.error("Error syncing proposal groupMembers:", syncError.message || syncError);
        }

        res.json({
            message: 'Student updated successfully',
            student: updatedStudent
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email or Roll Number must be unique' });
        }
        console.error("Error in updateStudent:", error.message || error);
        res.status(500).json({ message: "Server Error", error: error.message || error });
    }
};

// Delete Student
exports.deleteStudent = async (req, res) => {
    try {
        // Find and delete the student
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // ===== Delete all evaluations of this student =====
        try {
            await Evaluation.deleteMany({ studentId: student._id });
        } catch (evalError) {
            console.error('Error deleting evaluations for student:', evalError);
            return res.status(500).json({ message: 'Failed to delete student evaluations', error: evalError });
        }

        // ===== If student had a groupID, update proposal groupMembers =====
        if (student.groupID) {
            try {
                const proposal = await Proposal.findOne({ groupId: String(student.groupID) });
                if (proposal) {
                    proposal.groupMembers = proposal.groupMembers.filter(
                        roll => roll !== student.rollNumber
                    );
                    await proposal.save();
                }
            } catch (syncError) {
                console.error('Error updating proposal groupMembers on student delete:', syncError);
            }
        }

        res.json({ message: 'Student and related evaluations deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// Get Group Leader of logged-in student's group
exports.getGroupLeaderByGroupID = async (req, res) => {
    try {
        const groupID = req.user.groupID;

        // Find the group leader
        const groupLeader = await Student.findOne({
            groupID: groupID,
            student_role: "Group Leader"
        }).select("-password");

        // Find all group members
        const groupMembers = await Student.find({ groupID }).select("-password");

        // If the group leader is not found, we still proceed with the group members
        if (!groupLeader) {
            return res.status(404).json({
                message: "Group Leader not found for this group",
                groupMembers
            });
        }

        res.json({
            groupLeader,
            groupMembers
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

exports.getStudentDashboardData = async (req, res) => {
  try {
    const studentId = req.user.id;
    const currentDate = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(currentDate.getDate() + 30);

    const [pendingTasks, upcomingEvents, scheduledMeetings] = await Promise.all([
      // Modified task query to include date range
      Task.find({ 
        assignedTo: studentId, 
        status: 'Pending',
        dueDate: {
          $gte: currentDate,
          $lte: thirtyDaysLater
        }
      }).sort({ dueDate: 1 }),

      EventsAndCompetitions.find({
        eventDate: { 
          $gte: currentDate.toISOString().split('T')[0],
          $lte: thirtyDaysLater.toISOString().split('T')[0]
        }
      }).sort({ eventDate: 1, eventTime: 1 }),

      Meeting.find({
        "participants.students": studentId,
        status: "Scheduled",
        startTime: {
          $gte: currentDate,
          $lte: thirtyDaysLater
        }
      })
      .populate("participants.students", "name rollNumber")
      .populate("participants.supervisor", "name email")
      .populate("participants.coAdvisor", "name email")
      .populate("createdBy", "name email")
      .sort({ startTime: 1 })
    ]);

    res.status(200).json({
      success: true,
      data: {
        pendingTasks,
        upcomingEvents,
        scheduledMeetings
      },
      meta: {
        pendingTasksCount: pendingTasks.length,
        upcomingEventsCount: upcomingEvents.length,
        scheduledMeetingsCount: scheduledMeetings.length,
        dateRange: {
          start: currentDate,
          end: thirtyDaysLater
        }
      }
    });

  } catch (error) {
    console.error("Error in getStudentDashboardData:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message
    });
  }
};