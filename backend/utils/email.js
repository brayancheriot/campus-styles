const nodemailer = require('nodemailer');

const createTransporter = (requiresContactEmail = false) => {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
  if (requiresContactEmail) required.push('CONTACT_EMAIL');
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    const error = new Error(`Missing email configuration: ${missing.join(', ')}.`);
    error.code = 'EMAIL_CONFIG_MISSING';
    throw error;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error('SMTP_PORT must be a valid port number.');
    error.code = 'EMAIL_CONFIG_INVALID';
    throw error;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Reset your Campus Styles password',
    text: `Use this link to reset your password. It expires in one hour:\n\n${resetUrl}`,
    html: `<p>We received a request to reset your Campus Styles password.</p>
      <p><a href="${resetUrl.replace(/&/g, '&amp;')}">Reset your password</a></p>
      <p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
  });
};

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const sendContactEmail = async ({ name, email, message }) => {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);

  await createTransporter(true).sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.CONTACT_EMAIL,
    replyTo: email,
    subject: `Campus Styles contact message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    html: `<p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage.replace(/\n/g, '<br>')}</p>`,
  });
};

module.exports = { sendPasswordResetEmail, sendContactEmail };