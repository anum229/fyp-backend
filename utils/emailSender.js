const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

module.exports = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.response}`);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};