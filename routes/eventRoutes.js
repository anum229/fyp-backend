const express = require('express');
const router = express.Router();
const upload = require('../config/multer'); // Multer middleware for image upload
const {
  addEventCompetition,
  getAllEventsCompetitions,
  getSingleEventCompetition,
  updateEventCompetition,
  deleteEventCompetition
} = require('../controllers/eventController');
const { verifyToken, verifyFYPTeam } = require('../middleware/authMiddleware'); // Include security middlewares

// Add Event/Competition (Only accessible by FYP Team)
router.post('/', verifyFYPTeam, upload.single('eventImage'), addEventCompetition);

// Get All Events/Competitions (Accessible by all authenticated users)
router.get('/', verifyToken, getAllEventsCompetitions);

// Get Single Event/Competition by ID (Accessible by all authenticated users)
router.get('/:id', verifyToken, getSingleEventCompetition);

// Update Event/Competition by ID (Only accessible by FYP Team)
router.put('/:id', verifyFYPTeam, upload.single('eventImage'), updateEventCompetition);

// Delete Event/Competition by ID (Only accessible by FYP Team)
router.delete('/:id', verifyFYPTeam, deleteEventCompetition);

module.exports = router;