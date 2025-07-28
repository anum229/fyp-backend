const Meeting = require("../models/Meeting");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

const sendMeetingNotification = async (meeting) => {
    try {
        // In a real app, you would send emails/notifications here
        // This is just a placeholder implementation
        
        const populatedMeeting = await Meeting.findById(meeting._id)
            .populate("participants.students", "email name")
            .populate("participants.supervisor", "email name")
            .populate("participants.coAdvisor", "email name");

        const recipients = [
            ...populatedMeeting.participants.students.map(s => s.email),
            populatedMeeting.participants.supervisor.email,
            populatedMeeting.participants.coAdvisor?.email
        ].filter(Boolean);

        console.log(`Sending meeting notification to: ${recipients.join(", ")}`);
        
        return true;
    } catch (error) {
        console.error("Error sending notifications:", error);
        return false;
    }
};

module.exports = { sendMeetingNotification };