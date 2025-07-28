const express = require("express");
const router = express.Router();
const {
    createNotification,
    getMyNotifications,
    getAllNotifications,
} = require("../controllers/notificationController");

const { verifyToken, verifyFYPTeam } = require("../middleware/authMiddleware");

// Create notification → Only FYP Team
router.post("/", verifyToken, verifyFYPTeam, createNotification);

// Get my notifications → Students & Teachers (no query param needed)
router.get("/", verifyToken, getMyNotifications);

// Get all notifications → Only FYP Team
router.get("/all", verifyToken, verifyFYPTeam, getAllNotifications);

module.exports = router;