const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const previousBatchFypController = require('../controllers/previousBatchFypController');
const { verifyToken, verifyFYPTeam } = require('../middleware/authMiddleware');

// Get All FYPS
router.get('/getall', verifyToken, previousBatchFypController.getAllPreviousBatchFyps);

// Get FYP By ID
router.get('/get/:id', verifyToken, previousBatchFypController.getPreviousBatchFypById);

// Add FYP (Only FYP Team)
router.post('/add', verifyToken, verifyFYPTeam, previousBatchFypController.addPreviousBatchFyp);

// Update FYP (Only FYP Team)
router.put('/update/:id', verifyToken, verifyFYPTeam, previousBatchFypController.updatePreviousBatchFyp);

// Delete FYP (Only FYP Team)
router.delete('/delete/:id', verifyToken, verifyFYPTeam, previousBatchFypController.deletePreviousBatchFyp);

//Bulk Upload
router.post(
  '/bulkupload',
  verifyToken,
  verifyFYPTeam,
  upload.single('file'),  // <<< MISSING IN YOUR CASE
  previousBatchFypController.bulkUploadPreviousBatchFyps
);

module.exports = router;