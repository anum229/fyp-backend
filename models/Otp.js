const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true,
        index: true
    },
    otp: { 
        type: String, 
        required: true 
    },
    expiry: { 
        type: Date, 
        required: true,
        index: { expires: '5m' }  // OTP expires after 5 minutes
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
}, { timestamps: true });

// Invalidate old OTPs when a new OTP is generated for the same user
otpSchema.pre('save', async function(next) {
    if (this.isNew) {
        await mongoose.model('OTP').deleteMany({ email: this.email });  // Remove any previous OTPs for the same user
    }
    next();
});

module.exports = mongoose.model('OTP', otpSchema);