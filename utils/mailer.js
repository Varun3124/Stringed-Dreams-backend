const nodemailer = require('nodemailer');

// SMTP settings come from the environment. Defaults target Gmail, which needs an
// App Password (Google Account → Security → 2-Step Verification → App passwords).
const getConfig = () => {
  const port = Number(process.env.SMTP_PORT || 465);
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Stringed Dreams <${process.env.SMTP_USER}>` : undefined)
  };
};

const isEmailConfigured = () => {
  const { user, pass } = getConfig();
  return Boolean(user && pass);
};

let transporter = null;
let warnedNotConfigured = false;

const getTransporter = () => {
  if (transporter) return transporter;
  const { host, port, secure, user, pass } = getConfig();
  transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return transporter;
};

// Returns true when a message was handed to the SMTP server, false when email isn't configured
const sendMail = async ({ to, subject, text, html, replyTo }) => {
  if (!isEmailConfigured()) {
    if (!warnedNotConfigured) {
      console.warn('Email not sent: set SMTP_USER and SMTP_PASS to enable inquiry emails');
      warnedNotConfigured = true;
    }
    return false;
  }
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return false;

  await getTransporter().sendMail({
    from: getConfig().from,
    to: recipients.join(', '),
    replyTo,
    subject,
    text,
    html
  });
  return true;
};

module.exports = { sendMail, isEmailConfigured };
