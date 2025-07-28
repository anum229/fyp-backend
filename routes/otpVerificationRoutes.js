const express = require('express');
const { resendOtp, verifyOtp, getOtpRemainingTime } = require('../controllers/otpVerificationController');
const router = express.Router();

// Route for resending OTP
router.post('/resend', resendOtp);

// Route for OTP verification
router.post('/verify', verifyOtp);

// Route for getting the remaining OTP expiry time
router.post('/remaining-time', getOtpRemainingTime);

module.exports = router;