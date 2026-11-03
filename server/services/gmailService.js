import nodemailer from 'nodemailer';

export function gmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

async function sendCode(to, code, purpose) {
  if (!gmailConfigured()) throw Error('Gmail delivery is not configured.');
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  await transport.sendMail({
    from: { name: 'VanshLink', address: process.env.GMAIL_USER }, to,
    subject: purpose === 'password reset' ? 'Reset your VanshLink password' : 'Your VanshLink verification code',
    text: `Your VanshLink ${purpose} code is ${code}.\n\nIt expires in 5 minutes and can be used once. If you did not request this code, ignore this email.`,
  });
}

export const sendVerificationEmail = (to, code) => sendCode(to, code, 'email verification');
export const sendPasswordResetEmail = (to, code) => sendCode(to, code, 'password reset');
