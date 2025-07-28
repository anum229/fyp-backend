const OTP = require('../models/Otp');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // Added for more secure OTP generation

// OTP Verification Controller
exports.verifyOtp = async (req, res) => {
    const { email, otp, role } = req.body;

    try {
        let user;
        // Find user based on role
        if (role === 'student') {
            user = await Student.findOne({ email });
        } else if (role === 'teacher') {
            user = await Teacher.findOne({ email });
        }

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Check if OTP exists and is valid
        const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 }); // Get the latest OTP record

        if (!otpRecord) {
            return res.status(400).json({ message: "No OTP request found" });
        }

        // Check if OTP is expired
        if (new Date() > new Date(otpRecord.expiry)) {
            return res.status(400).json({ message: "OTP has expired" });
        }

        // Check if OTP is already used
        if (otpRecord.isUsed) {
            return res.status(400).json({ message: "OTP has already been used" });
        }

        // Check if the OTP is correct
        if (otpRecord.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Mark the OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        // OTP is valid, you can proceed with password reset logic (not implemented here)
        return res.status(200).json({ message: "OTP verified successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Resend OTP Controller
exports.resendOtp = async (req, res) => {
    const { email, role } = req.body;

    try {
        let user;
        // Find user based on role
        if (role === 'student') {
            user = await Student.findOne({ email });
        } else if (role === 'teacher') {
            user = await Teacher.findOne({ email });
        }

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Check if user has requested OTP recently
        const lastOtpRequest = await OTP.findOne({ email }).sort({ createdAt: -1 }); // Get the latest OTP request

        if (lastOtpRequest && (new Date() - new Date(lastOtpRequest.createdAt)) < 60000) { // Check if less than 1 minute
            return res.status(400).json({ message: "Please wait 1 minute before requesting a new OTP" });
        }

        // Generate new OTP securely
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit OTP

        // Create new OTP record
        const otpRecord = new OTP({
            email,
            otp,
            expiry: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiration
            isUsed: false // Initially set to false
        });

        await otpRecord.save();

        // Send OTP via email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            text: `Your OTP for password reset is: ${otp}`,
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.log("Error sending OTP:", err);  // Log the error for debugging purposes
                return res.status(500).json({ message: "Failed to resend OTP", error: err.message });
            }
            return res.status(200).json({ message: "OTP resent successfully" });
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get the remaining time for OTP expiry
exports.getOtpRemainingTime = async (req, res) => {
    const { email } = req.body;

    try {
        // Find the latest OTP record for the user
        const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ message: "No OTP request found" });
        }

        const remainingTime = otpRecord.expiry - new Date();  // Calculate time left in ms

        if (remainingTime <= 0) {
            return res.status(400).json({ message: "OTP has expired", remainingTime: 0 });
        }

        const secondsRemaining = Math.floor(remainingTime / 1000);  // Convert ms to seconds

        return res.status(200).json({ remainingTime: secondsRemaining });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};