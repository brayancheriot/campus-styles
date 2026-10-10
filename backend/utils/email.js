const nodemailer = require('nodemailer');

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Reset your Paulah Styles password',
    text: `Use this link to reset your password. It expires in one hour:\n\n${resetUrl}`,
    html: `<p>We received a request to reset your Paulah Styles password.</p>
      <p><a href="${resetUrl.replace(/&/g, '&amp;')}">Reset your password</a></p>
      <p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
  });
};

module.exports = { sendPasswordResetEmail };