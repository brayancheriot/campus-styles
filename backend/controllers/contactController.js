const { sendContactEmail } = require('../utils/email');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const sendContactMessage = async (req, res) => {
  const { name, email, message } = req.body || {};

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof message !== 'string'
  ) {
    return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
  }

  const contact = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    message: message.trim(),
  };

  if (contact.name.length < 2 || contact.name.length > 100) {
    return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters.' });
  }
  if (contact.email.length > 254 || !isValidEmail(contact.email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  if (contact.message.length < 10 || contact.message.length > 5000) {
    return res.status(400).json({ success: false, message: 'Message must be between 10 and 5000 characters.' });
  }

  try {
    await sendContactEmail(contact);
    return res.status(200).json({ success: true, message: 'Your message was sent. We will get back to you soon.' });
  } catch (error) {
    console.error('Contact email delivery failed:', error.code || 'SMTP_ERROR', error.message);
    return res.status(503).json({ success: false, message: 'We could not send your message right now. Please try again later.' });
  }
};

module.exports = { sendContactMessage };