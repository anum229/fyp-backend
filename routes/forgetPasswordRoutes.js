const express = require('express');
const { forgotPassword } = require('../controllers/forgetPasswordController');
const router = express.Router();

// Forgot Password Route
router.post('/forgotpassword', forgotPassword);

module.exports = router;
