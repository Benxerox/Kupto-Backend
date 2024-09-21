const nodemailer = require('nodemailer');
const asyncHandler = require('express-async-handler');


const sendEmail = asyncHandler(async (data) => {
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.MAIL_ID,
      pass: process.env.MP,
    },
  });

  // Send mail with defined transport object
  try {
    const info = await transporter.sendMail({
      from: `"Hey 👻" <${process.env.MAIL_ID}>`, // sender address
      to: data.to, // list of receivers
      subject: data.subject, // Subject line
      text: data.text, // plain text body
      html: data.html, // html body
    });

    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error('Failed to send email');
  }
});

module.exports = sendEmail;





