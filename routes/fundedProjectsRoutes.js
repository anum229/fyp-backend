const express = require("express");
const router = express.Router();
const fundedProjectsController = require("../controllers/fundedProjectsController");
const { verifyToken, verifyFYPTeam } = require("../middleware/authMiddleware");

// Anyone with valid token can access these 2 API's (Student, Teacher, FYP Team)
router.get("/getallfundedprojects", verifyToken, fundedProjectsController.getAllProjects);
router.get("/getfundedprojectbyid/:id", verifyToken, fundedProjectsController.getProjectById);

// Only FYP Team can access these API's
router.post("/createfundedproject", verifyFYPTeam, fundedProjectsController.createProject);
router.put("/updatefundedproject/:id", verifyFYPTeam, fundedProjectsController.updateProject);
router.delete("/deletefundedproject/:id", verifyFYPTeam, fundedProjectsController.deleteProject);

module.exports = router;