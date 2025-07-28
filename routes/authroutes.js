const express = require("express");
const router = express.Router();
const { register, loginUser, changePassword } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware"); // Import middleware

// Register Route (Only FYP Team can create teachers)
router.post("/register", authMiddleware.verifyToken, register);

// Login Route (Handles Student, Teacher, and FYP Team)
router.post("/login", loginUser);

// Change Password Route (Requires Authentication)
router.put("/change-password", authMiddleware.verifyToken, changePassword);

module.exports = router;