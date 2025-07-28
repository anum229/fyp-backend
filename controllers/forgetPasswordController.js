const Student = require('../models/Student');  // Assuming you have a Student model
const Teacher = require('../models/Teacher');  // Assuming you have a Teacher model
const OTP = require('../models/Otp');  // Assuming you have a separate OTP model
const nodemailer = require('nodemailer');

// Forgot Password Controller
exports.forgotPassword = async (req, res) => {
    const { email, role } = req.body;

    try {
        let user;

        // Check if the role is 'student' or 'teacher' and find the corresponding user
        if (role === 'student') {
            user = await Student.findOne({ email });  // Find student by email
        } else if (role === 'teacher') {
            user = await Teacher.findOne({ email });  // Find teacher by email
        }

        if (!user) {
            return res.status(400).json({ message: "User not found with the provided email" });
        }

        // Generate OTP (6-digit random number)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Create OTP entry in the OTP table with 5 minutes expiration
        const otpRecord = new OTP({
            email,
            otp,
            expiry: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiration
        });

        await otpRecord.save();  // Save OTP in the database

        // Set up Nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            text: `Your OTP for password reset is: ${otp}`,
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                return res.status(500).json({ message: "Failed to send OTP", error: err });
            }
            return res.status(200).json({ message: "OTP sent successfully" });
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};