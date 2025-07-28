const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

// Register a new user
exports.register = async (req, res) => {
    try {
        console.log("🔹 Incoming Register Request:", req.body);
        console.log("🔹 Authenticated User from Token:", req.user);

        const { name, email, password, user_role, student_role, rollNumber, department } = req.body;

        let student = await Student.findOne({ email });
        let teacher = await Teacher.findOne({ email });

        if (student || teacher) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Restrict teacher registration to FYP Team only
        if (user_role === "teacher") {
            if (!req.user || req.user.user_role !== "fyp_team") {
                return res.status(403).json({ message: "Access denied. Only FYP Team can create teachers." });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let newUser;
        if (user_role === "student") {
            newUser = new Student({ name, email, password: hashedPassword, rollNumber, department, student_role, user_role });
        } else if (user_role === "teacher") {
            newUser = new Teacher({ name, email, password: hashedPassword, department, user_role });
        } else {
            return res.status(400).json({ message: "Invalid user role specified" });
        }

        await newUser.save();
        res.status(201).json({ message: "User registered successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Login user (Student, Teacher, or FYP Team)
exports.loginUser = async (req, res) => {
    try {
        const { email, password, requestedRole } = req.body;

        // Handle FYP Team credentials separately
        if (requestedRole === "fyp_team" && email === "fypteam@yopmail.com") {
            if (password === "Abcd@1234") {
                const token = jwt.sign(
                    { id: "fyp_team_id", user_role: "fyp_team" },
                    process.env.JWT_SECRET,
                    { expiresIn: "1h" }
                );
                return res.json({ 
                    token,
                    actualRole: "fyp_team",
                    user: {
                        email,
                        user_role: "fyp_team"
                    }
                });
            }
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check for teacher first
        let user = await Teacher.findOne({ email });
        let userType = "teacher";

        // If not teacher, check student
        if (!user) {
            user = await Student.findOne({ email });
            userType = "student";
        }

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // For students, must match exactly
        if (userType === "student" && requestedRole !== "student") {
            return res.status(403).json({ 
                message: "Access denied. Students can only login as students"
            });
        }

        // For teachers
        if (userType === "teacher") {
            // Regular teachers can only login as teachers
            if (!user.facultyMember && requestedRole !== "teacher") {
                return res.status(403).json({ 
                    message: "Access denied. Regular teachers can only login as teachers"
                });
            }
            
            // Faculty members can login as either teacher or fyp_team
            if (user.facultyMember) {
                if (requestedRole !== "teacher" && requestedRole !== "fyp_team") {
                    return res.status(403).json({ 
                        message: "Access denied. Faculty members can only login as teachers or FYP Team"
                    });
                }
            }
        }

        // Prepare the user details for response
        let userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            user_role: requestedRole
        };

        // Include student-specific details if user is a student
        if (userType === "student") {
            userResponse = {
                ...userResponse,
                rollNumber: user.rollNumber || "N/A",
                batch: user.batch || "N/A",
                department: user.department || "N/A",
                student_role: user.student_role || "N/A",
                groupID: user.groupID || "N/A"
            };
        }

        // Include teacher-specific details if user is a teacher
        if (userType === "teacher") {
            userResponse = {
                ...userResponse,
                teacherID: user.teacherID || "N/A",
                phoneNumber: user.phoneNumber || "N/A",
                department: user.department || "N/A",
                isSupervisorOf: user.isSupervisorOf || null,
                isCoAdvisorOf: user.isCoAdvisorOf || [],
                facultyType: user.facultyType || "N/A",
                facultyMember: user.facultyMember || false
            };
        }

        // Determine the actual role to put in the token
        let tokenRole = requestedRole;
        if (userType === "teacher" && !user.facultyMember) {
            // Force regular teachers to always have 'teacher' role in token
            tokenRole = "teacher";
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user._id, 
                user_role: tokenRole, // Use determined role for token
                groupID: user.groupID || null
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ 
            token,
            actualRole: requestedRole, // Return the requested role in response
            user: userResponse
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

// Change Password API (Only for Student & Teacher)
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const { id, user_role } = req.user;

        if (user_role === "fyp_team") {
            return res.status(403).json({ message: "FYP Team cannot change password" });
        }

        let user = await Student.findById(id);
        if (!user) {
            user = await Teacher.findById(id);
        }

        if (!user) {
            return res.status(403).json({ message: "Only students and teachers can change passwords" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "New passwords do not match" });
        }

        // ✅ Strong password validation
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(newPassword)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect current password" });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: "Password changed successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
