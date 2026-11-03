import '../config/environment.js';
import nodemailer from 'nodemailer';
import { emailVerificationConfigured } from '../services/emailVerificationService.js';

console.log(`Google sign-in client ID: ${process.env.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com') ? 'configured' : 'missing or invalid'}`);
if (!emailVerificationConfigured()) {
  console.error('Gmail setup needs GMAIL_USER, GMAIL_APP_PASSWORD, and EMAIL_OTP_SECRET (at least 32 characters) in server/.env.');
  process.exitCode = 1;
} else {
  try {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transport.verify();
    console.log('Gmail SMTP connection and credentials verified. No email was sent.');
  } catch (error) {
    console.error(`Gmail SMTP check failed (${error.code || 'connection error'}). Check the App Password, network, and hosting SMTP restrictions.`);
    process.exitCode = 1;
  }
}
