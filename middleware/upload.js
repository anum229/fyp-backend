const multer = require('multer');
const { Readable } = require('stream');

// Since we're using Cloudinary, we don't need disk storage
const upload = multer({
  storage: multer.memoryStorage(), // Store file in memory
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;