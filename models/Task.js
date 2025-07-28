// models/Task.js

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: { // Given by the teacher
    type: String,
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  assignedDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Submitted'],
    default: 'Pending'
  },
  submissionDate: {
    type: Date
  },
  submittedFile: {
    type: String // Store the URL or file path
  },
  studentDescription: { // Given by the student during submission
    type: String
  }
});

module.exports = mongoose.model('Task', taskSchema);