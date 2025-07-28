const jwt = require("jsonwebtoken");

// Base verifyToken middleware (reusable)
const verifyToken = (req, res, next) => {
    console.log("🔹 Middleware triggered");

    const authHeader = req.header("Authorization");
    if (!authHeader) {
        console.log("❌ No token provided.");
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
        console.log("✅ Received Token:", token);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("🔹 Decoded Token:", decoded);

        req.user = {
            ...decoded,
            role: decoded.user_role // Standardized to 'role'
        };
        next();
    } catch (error) {
        console.log("❌ Token Verification Error:", error.message);
        return res.status(401).json({ message: `Invalid or expired token: ${error.message}` });
    }
};

// Middleware for FYP Team
exports.verifyFYPTeam = (req, res, next) => {
    verifyToken(req, res, () => {
        console.log("🔹 Checking FYP Team Access - Token Data:", req.user);
        if (req.user?.role !== "fyp_team") {
            return res.status(403).json({ message: "Access denied. Only FYP Team can access this resource." });
        }
        next();
    });
};

// Middleware for Students
exports.verifyStudentRole = (req, res, next) => {
    verifyToken(req, res, () => {
        console.log("🔹 Checking Student Role - Token Data:", req.user);
        if (req.user?.role !== "student") {
            return res.status(403).json({ message: "Access denied. Only students can access this resource." });
        }
        next();
    });
};

// Middleware for Teachers
exports.verifyTeacherRole = (req, res, next) => {
    verifyToken(req, res, () => {
        console.log("🔹 Current user role:", req.user?.role, "Full user:", req.user);
        
        // Allow both 'teacher' role and faculty members with 'fyp_team' role
        if (req.user?.role === "teacher" || req.user?.role === "fyp_team") {
            return next();
        }

        console.log("❌ Failed role check. Token contents:", req.user);
        return res.status(403).json({ 
            message: "Access denied. Requires teacher privileges." 
        });
    });
};

// Make verifyToken available if needed elsewhere
exports.verifyToken = verifyToken;