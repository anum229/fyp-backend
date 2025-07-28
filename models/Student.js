const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  groupID: { type: String, required: true },
  department: { type: String, required: true },
  batch: { type: String, required: true },
  student_role: { type: String, enum: ["Member", "Group Leader"], default: "Member" },
  user_role: { type: String, default: "student" },
  password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Student", StudentSchema);