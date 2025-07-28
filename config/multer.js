// config/multer.js

const multer = require('multer');

// Store files in memory for Cloudinary upload
const storage = multer.memoryStorage();

// Allow only PDFs (you can re-enable images if needed)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only PDF, JPG, PNG files are allowed.'));
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Optional: 5MB limit
    }
});

module.exports = upload;