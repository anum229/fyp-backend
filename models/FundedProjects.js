const mongoose = require('mongoose');

// Define the schema for funded/sponsored projects
const fundedProjectsSchema = new mongoose.Schema({
  projectTitle: { type: String, required: true },
  groupID: { type: String, required: true },
  department: { type: String, required: true },
  groupMembers: [{ type: String, required: true }], // Only roll numbers as strings
  fundedBy: { type: String, required: true },
}, { timestamps: true }); 

const FundedProjects = mongoose.model('FundedProjects', fundedProjectsSchema);
module.exports = FundedProjects;