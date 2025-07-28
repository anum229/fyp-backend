const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const forgetPasswordRoutes = require('./routes/forgetPasswordRoutes');
const otpVerificationRoutes = require('./routes/otpVerificationRoutes');
const resetPasswordRoutes = require('./routes/resetPasswordRoutes');
const proposalRoutes = require('./routes/proposalRoutes');
const fundedProjectsRoutes = require('./routes/fundedProjectsRoutes');
const previousBatchFypRoutes = require('./routes/previousBatchFypRoutes');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require("./routes/notificationRoutes");
const meetingRoutes = require('./routes/meetingRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const taskRoutes = require('./routes/taskRoutes');
const progressReportRoutes = require('./routes/progressReportRoutes');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Enhanced MongoDB connection with error handling
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000 // Close sockets after 45s of inactivity
})
.then(() => {
    console.log('MongoDB Connected');
    console.log('Current DB time:', new Date()); // Log DB server time for verification
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process on connection failure
});

// Connection event listeners
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

// Routes
app.use('/api/auth', forgetPasswordRoutes); // For Forgot Password
app.use('/api/auth', require('./routes/authroutes'));  // Existing auth routes
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/teachers', require('./routes/teacherRoutes'));
app.use('/api/otp', otpVerificationRoutes); // For OTP verification and resend
app.use('/api/auth', resetPasswordRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/fundedprojects', fundedProjectsRoutes);
app.use('/api/previousbatchfyp', previousBatchFypRoutes);
app.use('/api/events', eventRoutes);
app.use("/api/notifications", notificationRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/tasks', taskRoutes); 
app.use('/api/progress-reports', progressReportRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Starting the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Current server time:', new Date().toISOString()); // Log server startup time
});