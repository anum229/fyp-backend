const ProgressReport = require('../models/ProgressReport');
const Proposal = require('../models/Proposal');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const cloudinary = require('../config/cloudinary');
const { ObjectId } = require('mongoose').Types;

// Helper function to format display date (e.g., "Jan 2023")
const formatDisplayDate = (dateStr) => {
  const [year, month] = dateStr.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleString('default', { month: 'short' }) + ' ' + year;
};

// 1. Submit a new progress report
exports.submitProgressReport = async (req, res) => {
  try {
    const { comments, startPeriod, endPeriod } = req.body;
    const file = req.file;
    const teacherId = req.user.id; // From JWT token

    // Validate required fields
    if (!file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }
    if (!startPeriod || !endPeriod) {
      return res.status(400).json({ message: 'Both start and end periods are required' });
    }

    // Fetch teacher's current supervision status from database
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    const groupId = teacher.isSupervisorOf;
    if (!groupId) {
      return res.status(403).json({ 
        message: 'You are not currently assigned as a supervisor for any group' 
      });
    }

    // Validate period format (YYYY-MM)
    const dateRegex = /^\d{4}-\d{2}$/;
    if (!dateRegex.test(startPeriod) || !dateRegex.test(endPeriod)) {
      return res.status(400).json({ 
        message: 'Invalid period format. Use YYYY-MM (e.g., "2024-01")' 
      });
    }

    // Validate start < end period
    if (startPeriod >= endPeriod) {
      return res.status(400).json({ 
        message: 'End period must be after start period' 
      });
    }

    // Upload PDF to Cloudinary
    const result = await cloudinary.uploader.upload(file.path, {
      resource_type: 'raw',
      folder: 'progress_reports',
      filename_override: `${groupId}_${Date.now()}`,
      use_filename: true
    });

    // Create and save report
    const report = new ProgressReport({
      teacherId,
      groupId,
      fileName: file.originalname,
      fileUrl: result.secure_url,
      filePublicId: result.public_id,
      comments,
      startPeriod,
      endPeriod
    });

    await report.save();

    // Format response
    const response = {
      id: report._id,
      fileName: report.fileName,
      fileUrl: report.fileUrl,
      comments: report.comments,
      reportPeriod: `${formatDisplayDate(report.startPeriod)} - ${formatDisplayDate(report.endPeriod)}`,
      groupId: report.groupId,
      createdAt: report.createdAt
    };

    res.status(201).json({
      message: 'Progress report submitted successfully',
      report: response
    });

  } catch (err) {
    console.error("Error submitting progress report:", err);
    
    // Handle specific errors
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ 
        message: 'A report already exists for this group and period' 
      });
    }

    res.status(500).json({ 
      message: 'Server error during report submission',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 2. Get teacher's submitted reports
exports.getTeacherProgressReports = async (req, res) => {
  try {
    const reports = await ProgressReport.find({ teacherId: req.user.id })
      .sort({ createdAt: -1 });

    const formattedReports = reports.map(report => ({
      id: report._id,
      fileName: report.fileName,
      fileUrl: report.fileUrl,
      comments: report.comments,
      reportPeriod: `${formatDisplayDate(report.startPeriod)} - ${formatDisplayDate(report.endPeriod)}`,
      groupId: report.groupId,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));

    res.status(200).json(formattedReports);
  } catch (err) {
    console.error("Error fetching teacher's progress reports:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// 3. Get student's viewable reports
exports.getStudentProgressReports = async (req, res) => {
  try {
    // Get student's group
    const student = await Student.findById(req.user.id);
    if (!student || !student.groupID) {
      return res.status(404).json({ message: 'Student group not found' });
    }

    // Get reports for student's group with teacher details
    const reports = await ProgressReport.find({ groupId: student.groupID })
      .populate('teacherId', 'name')
      .sort({ createdAt: -1 });

    const formattedReports = reports.map(report => ({
      id: report._id,
      fileName: report.fileName,
      fileUrl: report.fileUrl,
      comments: report.comments,
      reportPeriod: `${formatDisplayDate(report.startPeriod)} - ${formatDisplayDate(report.endPeriod)}`,
      teacherName: report.teacherId.name,
      createdAt: report.createdAt
    }));

    res.status(200).json(formattedReports);
  } catch (err) {
    console.error("Error fetching student's progress reports:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// 4. Update a progress report
exports.updateProgressReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { comments, startPeriod, endPeriod } = req.body;
    const file = req.file;

    // Find the report
    const report = await ProgressReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Progress report not found' });
    }

    // Verify teacher owns this report
    if (report.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to update this report' });
    }

    // Prepare update data
    const updateData = {
      comments: comments || report.comments,
      startPeriod: startPeriod || report.startPeriod,
      endPeriod: endPeriod || report.endPeriod,
      updatedAt: new Date()
    };

    // Handle file update if provided
    if (file) {
      // First delete old file
      await cloudinary.uploader.destroy(report.filePublicId);

      // Upload new file
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'raw',
        folder: 'progress_reports'
      });

      updateData.fileName = file.originalname;
      updateData.fileUrl = result.secure_url;
      updateData.filePublicId = result.public_id;
    }

    // Validate period sequence
    if (updateData.startPeriod >= updateData.endPeriod) {
      throw new Error('End period must be after start period');
    }

    const updatedReport = await ProgressReport.findByIdAndUpdate(
      reportId,
      updateData,
      { new: true }
    );

    res.status(200).json({
      message: 'Progress report updated successfully',
      report: {
        id: updatedReport._id,
        fileName: updatedReport.fileName,
        fileUrl: updatedReport.fileUrl,
        comments: updatedReport.comments,
        reportPeriod: `${formatDisplayDate(updatedReport.startPeriod)} - ${formatDisplayDate(updatedReport.endPeriod)}`,
        updatedAt: updatedReport.updatedAt
      }
    });

  } catch (err) {
    console.error("Error updating progress report:", err);
    res.status(500).json({ 
      message: err.message.includes('End period must be after') 
        ? err.message 
        : "Server error",
      error: err.message 
    });
  }
};

// 5. Delete a progress report
exports.deleteProgressReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await ProgressReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Progress report not found' });
    }

    // Verify teacher owns this report
    if (report.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to delete this report' });
    }

    // Delete file from Cloudinary
    await cloudinary.uploader.destroy(report.filePublicId);

    // Delete from database
    await ProgressReport.findByIdAndDelete(reportId);

    res.status(200).json({ message: 'Progress report deleted successfully' });
  } catch (err) {
    console.error("Error deleting progress report:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//Get All Reports(FYp)
exports.getAllProgressReports = async (req, res) => {
  try {
    // Check if the user is from FYP Team
    if (req.user.user_role !== "fyp_team") {
      return res.status(403).json({ message: "Access denied. Only FYP Team can access this resource." });
    }

    // Fetch all progress reports with groupId and teacher info
    const reports = await ProgressReport.find()
      .populate("teacherId", "name email") // populate teacher details
      .sort({ createdAt: -1 });

    const formattedReports = reports.map(report => ({
      id: report._id,
      groupId: report.groupId,
      fileName: report.fileName,
      fileUrl: report.fileUrl,
      comments: report.comments,
      reportPeriod: `${formatDisplayDate(report.startPeriod)} - ${formatDisplayDate(report.endPeriod)}`,
      teacherName: report.teacherId?.name || "Unknown",
      teacherEmail: report.teacherId?.email || "N/A",
      createdAt: report.createdAt
    }));

    res.status(200).json(formattedReports);
  } catch (err) {
    console.error("Error fetching all progress reports:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};