const Teacher = require('../models/Teacher');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Proposal = require("../models/Proposal");
const EventsAndCompetitions = require('../models/Event');
const Meeting = require('../models/Meeting');
const { ObjectId } = require("mongodb");
const Student = require("../models/Student");
const mongoose = require('mongoose');
const { fieldsOfStudy, expertiseOptions } = require("../config/teacherConfig");
const csv = require('csv-parser');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');
const validator = require('validator');

exports.bulkUploadTeachers = async (req, res) => {
    try {
        if (req.user.user_role !== "fyp_team") {
            return res.status(403).json({ message: "Access denied. Only FYP Team can perform bulk uploads." });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const results = [];
        const errors = [];
        let processedCount = 0;

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

        const stream = Readable.from(req.file.buffer)
            .pipe(csv())
            .on('data', (data) => {
                processedCount++;
                try {
                    if (!data.name || !data.teacherID || !data.email || !data.password) {
                        errors.push({
                            row: processedCount,
                            error: 'Missing required fields',
                            data
                        });
                        return;
                    }

                    // ✅ Email format validation using validator
                    if (!validator.isEmail(data.email)) {
                        errors.push({
                            row: processedCount,
                            error: 'Invalid email format',
                            data
                        });
                        return;
                    }

                    // ✅ Password strength validation
                    if (!passwordRegex.test(data.password)) {
                        errors.push({
                            row: processedCount,
                            error: 'Weak password: Must include uppercase, lowercase, number, special character, and be at least 8 characters long',
                            data
                        });
                        return;
                    }

                    const teacherData = {
                        name: data.name,
                        teacherID: data.teacherID,
                        email: data.email,
                        phoneNumber: data.phoneNumber || '',
                        department: data.department || '',
                        facultyType: data.facultyType || 'Permanent',
                        facultyMember: data.facultyMember ? data.facultyMember.toLowerCase() === 'true' : false,
                        password: data.password,
                        educationLevel: data.educationLevel || '',
                        fieldOfStudy: data.fieldOfStudy || '',
                        expertise: data.expertise ? data.expertise.split('|').map(item => item.trim()) : []
                    };

                    results.push(teacherData);
                } catch (error) {
                    errors.push({
                        row: processedCount,
                        error: error.message,
                        data
                    });
                }
            });

        await new Promise((resolve) => stream.on('end', resolve));

        const cloudinaryUpload = await new Promise((resolve) => {
            cloudinary.uploader.upload_stream(
                { resource_type: 'raw', folder: 'teacher-uploads' },
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

        let successCount = 0;

        for (const teacherData of results) {
            try {
                const exists = await Teacher.findOne({
                    $or: [
                        { email: teacherData.email },
                        { teacherID: teacherData.teacherID }
                    ]
                });

                if (exists) {
                    errors.push({
                        row: results.indexOf(teacherData) + 1,
                        error: 'Teacher with this email or ID already exists',
                        data: teacherData
                    });
                    continue;
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(teacherData.password, salt);

                const teacher = new Teacher({
                    ...teacherData,
                    password: hashedPassword,
                    user_role: teacherData.facultyMember ? "fyp_team" : "teacher",
                    isSupervisorOf: null,
                    isCoAdvisorOf: null
                });

                await teacher.save();
                successCount++;
            } catch (error) {
                errors.push({
                    row: results.indexOf(teacherData) + 1,
                    error: error.message,
                    data: teacherData
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

// Register Teacher (Only FYP Team)
exports.registerTeacher = async (req, res) => {
    try {
        if (req.user.user_role !== "fyp_team") {
            return res.status(403).json({ message: "Access denied. Only FYP Team can create teachers." });
        }

        const {
            name,
            teacherID,
            email,
            phoneNumber,
            department,
            facultyType,
            facultyMember,
            password
        } = req.body;

        // ✅ Email format validation
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // ✅ Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
            });
        }

        // ✅ Uniqueness check
        const existingTeacher = await Teacher.findOne({ $or: [{ email }, { teacherID }] });
        if (existingTeacher) {
            return res.status(400).json({ message: 'Teacher with this email or teacher ID already exists' });
        }

        // ✅ Hash and save
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newTeacher = new Teacher({
            name,
            teacherID,
            email,
            phoneNumber,
            department,
            facultyType,
            facultyMember,
            isSupervisorOf: null,
            isCoAdvisorOf: null,
            user_role: facultyMember ? "fyp_team" : "teacher",
            password: hashedPassword
        });

        await newTeacher.save();
        res.status(201).json({ message: 'Teacher registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// Get All Teachers (Only FYP Team)
exports.getAllTeachers = async (req, res) => {
    try {
        if (req.user.user_role !== "fyp_team") {
            return res.status(403).json({ message: "Access denied. Only FYP Team can access this resource." });
        }

        const teachers = await Teacher.find();
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// Get Teacher by ID (Only FYP Team)
exports.getTeacherById = async (req, res) => {
    try {
        if (req.user.user_role !== "fyp_team") {
            return res.status(403).json({ message: "Access denied. Only FYP Team can access this resource." });
        }

        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        res.json(teacher);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// Update Teacher (Only FYP Team)
exports.updateTeacher = async (req, res) => {
    try {
        if (req.user.user_role !== "fyp_team") {
            return res.status(403).json({ message: "Access denied. Only FYP Team can update teachers." });
        }

        let teacher = await Teacher.findById(req.params.id);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const { email, password, facultyMember } = req.body;

        // ✅ Email format validation if being updated
        if (email && !validator.isEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // ✅ Password strength validation if being updated
        if (password) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!passwordRegex.test(password)) {
                return res.status(400).json({
                    message:
                        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
                });
            }

            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(password, salt);
        } else {
            req.body.password = teacher.password; // Preserve existing password
        }

        // ✅ Set user_role based on facultyMember
        if (facultyMember !== undefined) {
            req.body.user_role = facultyMember ? "fyp_team" : "teacher";
        }

        // 🧹 Clean unwanted fields
        delete req.body.assignedGroup;

        teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.json({
            message: 'Teacher updated successfully',
            teacher
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// Delete Teacher (Only FYP Team)
exports.deleteTeacher = async (req, res) => {
    try {
        if (req.user.user_role !== "fyp_team") {
            return res.status(403).json({ message: "Access denied. Only FYP Team can delete teachers." });
        }

        const teacher = await Teacher.findByIdAndDelete(req.params.id);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Set teacher references to null in proposals instead of deleting the field
        await Proposal.updateMany(
            {
                $or: [
                    { assigned_teacher: teacher._id },
                    { assigned_coadvisor: teacher._id },
                ]
            },
            [
                {
                    $set: {
                        assigned_teacher: {
                            $cond: [{ $eq: ["$assigned_teacher", teacher._id] }, null, "$assigned_teacher"]
                        },
                        assigned_coadvisor: {
                            $cond: [{ $eq: ["$assigned_coadvisor", teacher._id] }, null, "$assigned_coadvisor"]
                        },
                    }
                }
            ]
        );

        res.json({ message: 'Teacher deleted successfully and references set to null in proposals.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

exports.getTeacherGroups = async (req, res) => {
    try {
      const teacherId = req.user.id; // From JWT token
  
      // Find all proposals where teacher is involved
      const proposals = await Proposal.find({
        $or: [
          { assigned_teacher: new ObjectId(teacherId) },
          { assigned_coadvisor: new ObjectId(teacherId) },
        ],
      });
  
      // Categorize proposals
      const result = {
        supervisingGroups: proposals.filter(p => 
          p.assigned_teacher.toString() === teacherId
        ),
        coAdvisingGroups: proposals.filter(p => 
          p.assigned_coadvisor?.toString() === teacherId
        ),
      };
  
      res.status(200).json(result);
    } catch (err) {
      console.error("Error fetching teacher groups:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  };

  exports.getSupervisingGroupLeaderEmail = async (req, res) => {
    try {
        const teacherId = req.user.id;

        // Validate teacherId format
        if (!mongoose.Types.ObjectId.isValid(teacherId)) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid teacher ID format" 
            });
        }

        // Find all proposals where teacher is supervisor
        const supervisingGroups = await Proposal.find({
            assigned_teacher: new mongoose.Types.ObjectId(teacherId)
        }).lean();

        if (!supervisingGroups.length) {
            return res.status(404).json({ 
                success: false,
                message: "No supervising groups found for this teacher" 
            });
        }

        // Extract all submitter IDs at once
        const submitterIds = supervisingGroups
            .map(group => group.submittedBy)
            .filter(id => mongoose.Types.ObjectId.isValid(id));

        // Fetch all submitters in a single query
        const submitters = await Student.find({
            _id: { $in: submitterIds }
        }).select('email name rollNumber').lean();

        // Create a map for quick lookup
        const submitterMap = submitters.reduce((acc, student) => {
            acc[student._id.toString()] = student;
            return acc;
        }, {});

        // Prepare response
        const response = supervisingGroups.map(group => ({
            groupId: group.groupId,
            projectTitle: group.projectTitle,
            submittedBy: submitterMap[group.submittedBy] ? {
                email: submitterMap[group.submittedBy].email,
                name: submitterMap[group.submittedBy].name,
                rollNumber: submitterMap[group.submittedBy].rollNumber
            } : null,
            submissionDetails: {
                submittedAt: group.submittedAt,
                status: group.status,
                fypStatus: group.fypStatus,
                fypFeedback: group.fypFeedback
            }
        }));

        res.status(200).json({
            success: true,
            count: response.length,
            groups: response
        });

    } catch (error) {
        console.error("Error in getSupervisingGroupLeaderEmail:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get teacher's education and expertise
exports.getTeacherEducationExpertise = async (req, res) => {
    try {
      const teacher = await Teacher.findById(req.user.id)
        .select('educationLevel fieldOfStudy expertise');
      
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
  
      res.json({
        educationLevel: teacher.educationLevel,
        fieldOfStudy: teacher.fieldOfStudy,
        expertise: teacher.expertise
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error });
    }
  };
  
  // Update teacher's education and expertise
  exports.updateTeacherEducationExpertise = async (req, res) => {
    try {
      const { educationLevel, fieldOfStudy, expertise } = req.body;
      
      // Validate expertise - must be subset of allowed options
      const invalidExpertise = expertise.filter(
        exp => !expertiseOptions.includes(exp)
      );
      
      if (invalidExpertise.length > 0) {
        return res.status(400).json({
          message: 'Invalid expertise options provided',
          invalidOptions: invalidExpertise
        });
      }
  
      // Validate field of study based on education level
      if (educationLevel && fieldOfStudy) {
        const validFields = fieldsOfStudy[educationLevel] || [];
        if (!validFields.includes(fieldOfStudy)) {
          return res.status(400).json({
            message: 'Invalid field of study for selected education level'
          });
        }
      }
  
      const updatedTeacher = await Teacher.findByIdAndUpdate(
        req.user.id,
        {
          educationLevel,
          fieldOfStudy,
          expertise
        },
        { new: true, runValidators: true }
      );
  
      res.json({
        message: 'Education & Expertise updated successfully',
        teacher: {
          educationLevel: updatedTeacher.educationLevel,
          fieldOfStudy: updatedTeacher.fieldOfStudy,
          expertise: updatedTeacher.expertise
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error });
    }
  };
  
  // Get all expertise options (for dropdown)
  exports.getExpertiseOptions = async (req, res) => {
    try {
      res.json({ expertiseOptions });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error });
    }
  };

  // Get all fields of study options (for dropdown)
exports.getFieldsOfStudyOptions = async (req, res) => {
    try {
      res.json({ fieldsOfStudy });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error });
    }
  };

  exports.getTeacherDashboardData = async (req, res) => {
  try {
    const teacherId = req.user.id; // Get teacher ID from token
    const currentDate = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(currentDate.getDate() + 30);

    // Fetch events and meetings in parallel
    const [upcomingEvents, scheduledMeetings] = await Promise.all([
      // Get events within the next 30 days
      EventsAndCompetitions.find({
        eventDate: { 
          $gte: currentDate.toISOString().split('T')[0],
          $lte: thirtyDaysLater.toISOString().split('T')[0]
        }
      }).sort({ eventDate: 1, eventTime: 1 }),

      // Get meetings where teacher is supervisor/co-advisor within next 30 days
      Meeting.find({
        $or: [
          { "participants.supervisor": teacherId },
          { "participants.coAdvisor": teacherId }
        ],
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
        upcomingEvents,
        scheduledMeetings
      },
      meta: {
        upcomingEventsCount: upcomingEvents.length,
        scheduledMeetingsCount: scheduledMeetings.length,
        dateRange: {
          start: currentDate,
          end: thirtyDaysLater
        }
      }
    });

  } catch (error) {
    console.error("Error in getTeacherDashboardData:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message
    });
  }
};

// teacherController.js - Add this new endpoint
exports.getTeacherEducationExpertiseById = async (req, res) => {
    try {
      const teacher = await Teacher.findById(req.params.id)
        .select('educationLevel fieldOfStudy expertise');
      
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
  
      res.json({
        educationLevel: teacher.educationLevel,
        fieldOfStudy: teacher.fieldOfStudy,
        expertise: teacher.expertise
      });
    } catch (error) {
      res.status(500).json({ message: 'Server Error', error });
    }
};