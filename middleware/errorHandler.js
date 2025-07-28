// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
  
    // Handle Multer errors
    if (err.name === 'MulterError') {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  
    // Handle other errors
    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  };
  
  module.exports = errorHandler;