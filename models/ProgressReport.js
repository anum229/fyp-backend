const mongoose = require('mongoose');

const progressReportSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  groupId: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  filePublicId: {
    type: String,
    required: true
  },
  comments: {
    type: String,
    required: true
  },
  startPeriod: {
    type: String, // Format: "YYYY-MM"
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid period format (YYYY-MM)!`
    }
  },
  endPeriod: {
    type: String, // Format: "YYYY-MM"
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid period format (YYYY-MM)!`
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Validate endPeriod is after startPeriod
progressReportSchema.pre('save', function(next) {
  if (this.startPeriod >= this.endPeriod) {
    throw new Error('End period must be after start period');
  }
  next();
});

module.exports = mongoose.model('ProgressReport', progressReportSchema);