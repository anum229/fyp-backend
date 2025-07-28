const mongoose = require('mongoose');
const path = require('path');

// Adjust these paths according to your project structure
const Student = require('./models/Student');  // or './src/models/Student'
const Group = require('./models/Group');      // or './src/models/Group'

async function revertMigration() {
  try {
    console.log('🔍 Looking for models at:');
    console.log(`- Student: ${path.resolve('./models/Student.js')}`);
    console.log(`- Group: ${path.resolve('./models/Group.js')}`);

    await mongoose.connect('mongodb://localhost:27017/smart_fyp_portal', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('🚀 Connected to database');

    // Step 1: Remove all groups
    const deleteResult = await Group.deleteMany({});
    console.log(`✔️ Removed ${deleteResult.deletedCount} groups`);

    // Step 2: Reset student group references
    const updateResult = await Student.updateMany(
      { groupID: { $exists: true } },
      { $unset: { groupID: "" } }
    );
    console.log(`✔️ Reset groupID for ${updateResult.modifiedCount} students`);

    console.log('✅ Reversion completed successfully');
  } catch (error) {
    console.error('❌ Reversion failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

revertMigration();