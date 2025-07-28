const FundedProjects = require('../models/FundedProjects');

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