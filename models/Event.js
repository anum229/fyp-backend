const mongoose = require('mongoose');

const eventsAndCompetitionsSchema = new mongoose.Schema(
  {
    eventTitle: {
      type: String,
      required: true
    },
    eventDate: {
      type: String,
      required: true
    },
    eventTime: {
      type: String,
      required: true
    },
    eventVenue: {
      type: String,
      required: true
    },
    eventDescription: {
      type: String,
      required: true
    },
    eventImage: {
      type: String,
      required: true
    },
    eventWinner: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EventsAndCompetitions', eventsAndCompetitionsSchema);