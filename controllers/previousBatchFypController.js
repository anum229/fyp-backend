const PreviousBatchFyp = require('../models/previousBatchFypModel');
const csv = require('csv-parser');
const { Readable } = require('stream');

exports.bulkUploadPreviousBatchFyps = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No CSV file uploaded' });
  }

  const fyps = [];
  const stream = Readable.from(req.file.buffer);

  stream
    .pipe(csv())
    .on('data', (row) => {
      // Parse comma-separated groupMembers
      const groupMembersArray = row.groupMembers
        ? row.groupMembers.split(',').map((member) => member.trim())
        : [];

      fyps.push({
        groupID: row.groupID,
        department: row.department,
        groupMembers: groupMembersArray,
        year: parseInt(row.year),
        projectTitle: row.projectTitle,
      });
    })
    .on('end', async () => {
      try {
        const insertedFyps = await PreviousBatchFyp.insertMany(fyps);
        res.status(201).json({
          message: 'Bulk upload successful',
          added: insertedFyps.length,
          data: insertedFyps,
        });
      } catch (error) {
        res.status(500).json({ message: 'Bulk upload failed', error });
      }
    });
};

// Add Previous Batch FYP
exports.addPreviousBatchFyp = async (req, res) => {
  try {
    const newFyp = new PreviousBatchFyp(req.body);
    await newFyp.save();
    res.status(201).json({ message: 'Previous Batch FYP Added Successfully', data: newFyp });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Previous Batch FYPs
exports.getAllPreviousBatchFyps = async (req, res) => {
  try {
    const fyps = await PreviousBatchFyp.find();
    res.status(200).json(fyps);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Previous Batch FYP By ID
exports.getPreviousBatchFypById = async (req, res) => {
  try {
    const fyp = await PreviousBatchFyp.findById(req.params.id);
    if (!fyp) {
      return res.status(404).json({ message: 'FYP Not Found' });
    }
    res.status(200).json(fyp);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Previous Batch FYP
exports.updatePreviousBatchFyp = async (req, res) => {
  try {
    const fyp = await PreviousBatchFyp.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!fyp) {
      return res.status(404).json({ message: 'FYP Not Found' });
    }
    res.status(200).json({ message: 'FYP Updated Successfully', data: fyp });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Previous Batch FYP
exports.deletePreviousBatchFyp = async (req, res) => {
  try {
    const fyp = await PreviousBatchFyp.findByIdAndDelete(req.params.id);
    if (!fyp) {
      return res.status(404).json({ message: 'FYP Not Found' });
    }
    res.status(200).json({ message: 'FYP Deleted Successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};