const bcrypt = require("bcryptjs");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const OTP = require("../models/Otp");

// Reset Password Controller
exports.resetPassword = async (req, res) => {
    const { email, newPassword, role } = req.body;

    try {
        let user;
        if (role === "student") {
            user = await Student.findOne({ email });
        } else if (role === "teacher") {
            user = await Teacher.findOne({ email });
        }

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // ✅ Strong password validation
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(newPassword)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
            });
        }

        // ✅ Check OTP verification
        const otpRecord = await OTP.findOne({ email });
        if (!otpRecord) {
            return res.status(400).json({ message: "OTP verification required before resetting password" });
        }

        // ✅ Hash and update password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        await user.save();

        // ✅ Remove OTP after successful reset
        await OTP.deleteOne({ email });

        return res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};