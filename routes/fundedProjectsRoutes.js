const express = require("express");
const router = express.Router();
const multer = require("multer");
const fundedProjectsController = require("../controllers/fundedProjectsController");
const { verifyToken, verifyFYPTeam } = require("../middleware/authMiddleware");

// Configure multer for file uploads (in-memory buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Anyone with valid token can access these 2 API's (Student, Teacher, FYP Team)
router.get("/getallfundedprojects", verifyToken, fundedProjectsController.getAllProjects);
router.get("/getfundedprojectbyid/:id", verifyToken, fundedProjectsController.getProjectById);

// Only FYP Team can access these API's
router.post("/createfundedproject", verifyFYPTeam, fundedProjectsController.createProject);
router.put("/updatefundedproject/:id", verifyFYPTeam, fundedProjectsController.updateProject);
router.delete("/deletefundedproject/:id", verifyFYPTeam, fundedProjectsController.deleteProject);

// ✅ NEW: Bulk Upload Funded Projects (CSV) - FYP Team Only
router.post(
  "/bulkuploadfundedprojects",
  verifyFYPTeam,
  upload.single("file"),
  fundedProjectsController.bulkUploadFundedProjects
);

module.exports = router;