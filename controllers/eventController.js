const EventsAndCompetitions = require('../models/Event.js');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier'); // For buffer streaming to Cloudinary

// Add Event/Competition
const addEventCompetition = async (req, res) => {
  try {
    const { eventTitle, eventDate, eventTime, eventVenue, eventDescription, eventWinner } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Event Image is required' });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'eventsImages' },
      async (error, result) => {
        if (error) {
          return res.status(500).json({ message: 'Cloudinary Upload Error', error: error.message });
        }

        const newEvent = new EventsAndCompetitions({
          eventTitle,
          eventDate,
          eventTime,
          eventVenue,
          eventDescription,
          eventWinner,
          eventImage: result.secure_url
        });

        await newEvent.save();

        res.status(201).json({ message: 'Event/Competition Added Successfully', data: newEvent });
      }
    );

    uploadStream.end(req.file.buffer);

  } catch (error) {
    res.status(500).json({ message: 'Error Adding Event', error: error.message });
  }
};

// Get All Events/Competitions
const getAllEventsCompetitions = async (req, res) => {
  try {
    const events = await EventsAndCompetitions.find().sort({ createdAt: -1 });
    res.status(200).json({ message: 'All Events/Competitions', data: events });
  } catch (error) {
    res.status(500).json({ message: 'Error Fetching Events', error: error.message });
  }
};

// Get Single Event/Competition
const getSingleEventCompetition = async (req, res) => {
  try {
    const event = await EventsAndCompetitions.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event/Competition Not Found' });
    }

    res.status(200).json({ message: 'Event/Competition Details', data: event });
  } catch (error) {
    res.status(500).json({ message: 'Error Fetching Event', error: error.message });
  }
};

// Update Event/Competition
const updateEventCompetition = async (req, res) => {
  try {
    const { eventTitle, eventDate, eventTime, eventVenue, eventDescription, eventWinner } = req.body;

    const event = await EventsAndCompetitions.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event/Competition Not Found' });
    }

    // Update fields
    event.eventTitle = eventTitle || event.eventTitle;
    event.eventDate = eventDate || event.eventDate;
    event.eventTime = eventTime || event.eventTime;
    event.eventVenue = eventVenue || event.eventVenue;
    event.eventDescription = eventDescription || event.eventDescription;
    event.eventWinner = eventWinner || event.eventWinner;

    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'eventsImages' },
        async (error, result) => {
          if (error) {
            return res.status(500).json({ message: 'Cloudinary Upload Error', error: error.message });
          }

          event.eventImage = result.secure_url;
          await event.save();
          res.status(200).json({ message: 'Event/Competition Updated Successfully', data: event });
        }
      );

      uploadStream.end(req.file.buffer);
    } else {
      await event.save();
      res.status(200).json({ message: 'Event/Competition Updated Successfully', data: event });
    }

  } catch (error) {
    res.status(500).json({ message: 'Error Updating Event', error: error.message });
  }
};

// Delete Event/Competition
const deleteEventCompetition = async (req, res) => {
  try {
    const event = await EventsAndCompetitions.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event/Competition Not Found' });
    }

    res.status(200).json({ message: 'Event/Competition Deleted Successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error Deleting Event', error: error.message });
  }
};

module.exports = {
  addEventCompetition,
  getAllEventsCompetitions,
  getSingleEventCompetition,
  updateEventCompetition,
  deleteEventCompetition
};
