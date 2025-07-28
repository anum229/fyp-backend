const mongoose = require('mongoose');

const previousBatchFypSchema = new mongoose.Schema(
  {
    groupID: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    groupMembers: {  
      type: [String],  
      required: true,   
    },
    year: {
      type: Number,
      required: true,
    },
    projectTitle: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PreviousBatchFyp', previousBatchFypSchema);
