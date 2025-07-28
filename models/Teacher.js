const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema({
  // ============== EXISTING FIELDS (UNCHANGED) ==============
  name: { type: String, required: true },
  teacherID: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  department: { type: String, required: true },
  isSupervisorOf: { type: String, default: null }, 
  isCoAdvisorOf: { type: [String], default: [] },  
  facultyType: { type: String, required: true },
  facultyMember: { 
    type: Boolean, 
    required: true,
    default: false 
  },
  user_role: { 
    type: String, 
    required: true, 
    default: "teacher",
    enum: ["teacher", "fyp_team"]
  },
  password: { type: String, required: true },

  // ============== NEW FIELDS ADDED BELOW ==============
  educationLevel: {
    type: String,
    enum: ["BS", "MS", "PhD", ""], // Allowed values + empty string
    default: "" // Default empty (instead of null)
  },
  fieldOfStudy: {
    type: String,
    default: "" // Default empty string
  },
  expertise: {
    type: [String], // Array of strings
    default: [] // Empty array by default
  }
}, { timestamps: true }); // <-- Keeping your original options

module.exports = mongoose.model("Teacher", TeacherSchema);