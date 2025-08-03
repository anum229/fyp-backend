const FundedProjects = require('../models/FundedProjects');
const csv = require('csv-parser');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary'); // Your existing path

exports.bulkUploadFundedProjects = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Optional: Upload the file to Cloudinary (as raw file)
    const cloudinaryUpload = await new Promise((resolve) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'project-uploads' },
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

    const stream = Readable.from(req.file.buffer)
      .pipe(csv())
      .on('data', (data) => {
        processedCount++;
        try {
          const row = processedCount;

          // Destructure and trim
          let {
            projectTitle,
            groupID,
            department,
            groupMembers,
            fundedBy
          } = data;

          projectTitle = projectTitle?.trim();
          groupID = groupID?.trim();
          department = department?.trim();
          fundedBy = fundedBy?.trim();
          groupMembers = groupMembers?.trim();

          // Validate required fields
          if (!projectTitle || !groupID || !department || !groupMembers || !fundedBy) {
            errors.push({ row, error: 'Missing required fields', data });
            return;
          }

          // Parse groupMembers into array
          const memberList = groupMembers.split(',').map(m => m.trim()).filter(Boolean);
          if (memberList.length === 0) {
            errors.push({ row, error: 'Group members list is empty or invalid', data });
            return;
          }

          results.push({
            projectTitle,
            groupID,
            department,
            groupMembers: memberList,
            fundedBy
          });

        } catch (err) {
          errors.push({ row: processedCount, error: err.message, data });
        }
      });

    await new Promise((resolve) => stream.on('end', resolve));

    let successCount = 0;

    for (const projectData of results) {
      try {
        const exists = await FundedProjects.findOne({ groupID: projectData.groupID });
        if (exists) {
          errors.push({
            row: results.indexOf(projectData) + 1,
            error: `Project with groupID ${projectData.groupID} already exists`,
            data: projectData
          });
          continue;
        }

        const newProject = new FundedProjects(projectData);
        await newProject.save();
        successCount++;
      } catch (err) {
        errors.push({
          row: results.indexOf(projectData) + 1,
          error: err.message,
          data: projectData
        });
      }
    }

    return res.status(200).json({
      message: 'Bulk funded projects upload completed',
      cloudinary_url: cloudinaryUpload?.secure_url,
      total: processedCount,
      success: successCount,
      errors: errors.length,
      errorDetails: errors
    });

  } catch (err) {
    return res.status(500).json({
      message: 'Server error during bulk upload',
      error: err.message
    });
  }
};

// Get all funded projects
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await FundedProjects.find();
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: "Error fetching projects", error });
  }
};

// Get funded project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await FundedProjects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: "Error fetching project", error });
  }
};

// Create a new funded project
exports.createProject = async (req, res) => {
  const { projectTitle, groupID, department, groupMembers, fundedBy } = req.body;

  try {
    const newProject = new FundedProjects({
      projectTitle,
      groupID,
      department,
      groupMembers, // Directly store the roll numbers as strings
      fundedBy,
    });

    await newProject.save();
    res.status(201).json({ message: "Project added successfully", project: newProject });
  } catch (error) {
    res.status(500).json({ message: "Error creating project", error });
  }
};

// Update a funded project
exports.updateProject = async (req, res) => {
  try {
    const updatedProject = await FundedProjects.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(200).json({ message: "Project updated successfully", project: updatedProject });
  } catch (error) {
    res.status(500).json({ message: "Error updating project", error });
  }
};

// Delete a funded project
exports.deleteProject = async (req, res) => {
  try {
    const project = await FundedProjects.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting project", error });
  }
};