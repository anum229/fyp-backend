const Notification = require("../models/Notification");

// Create a new notification (FYP Team only)
const createNotification = async (req, res) => {
    try {
        const { subject, body, recipients } = req.body;

        if (!subject || !body || (!recipients.students && !recipients.teachers)) {
            return res.status(400).json({ 
                message: "All fields are required and at least one recipient must be selected.",
                details: {
                    requiredFields: ["subject", "body"],
                    atLeastOneRecipient: ["students", "teachers"]
                }
            });
        }

        const notification = new Notification({
            subject,
            body,
            recipients
        });

        await notification.save();
        
        res.status(201).json({ 
            message: "Notification created successfully", 
            notification
        });
    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).json({ 
            message: "Server error while creating notification",
            error: error.message 
        });
    }
};

// Get all notifications based on user role (student/teacher)
const getMyNotifications = async (req, res) => {
    try {
        const userRole = req.user.role; // Extracted from token
        
        if (!["student", "teacher"].includes(userRole)) {
            return res.status(400).json({ 
                message: "Invalid user role",
                validRoles: ["student", "teacher"]
            });
        }

        const filter = {};
        if (userRole === "student") filter["recipients.students"] = true;
        if (userRole === "teacher") filter["recipients.teachers"] = true;

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 });
            
        res.status(200).json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ 
            message: "Server error while fetching notifications",
            error: error.message 
        });
    }
};


// Get all notifications (FYP Team only)
const getAllNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find()
            .sort({ createdAt: -1 });
            
        res.status(200).json(notifications);
    } catch (error) {
        console.error("Error fetching all notifications:", error);
        res.status(500).json({ 
            message: "Server error while fetching all notifications",
            error: error.message 
        });
    }
};

module.exports = {
    createNotification,
    getMyNotifications,
    getAllNotifications,
};