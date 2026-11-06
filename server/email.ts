import nodemailer from 'nodemailer';
import { env } from './env.js';

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${env('APP_URL')}/reset-password?token=${token}`;

  // With no Gmail account set up during development, print the link instead of sending it.
  if (!process.env.GMAIL_USER && process.env.NODE_ENV !== 'production') {
    console.log(`Password reset link for ${to}: ${link}`);
    return;
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env('GMAIL_USER'), pass: env('GMAIL_APP_PASSWORD') },
  });
  await transport.sendMail({
    from: `Tierdle <${env('GMAIL_USER')}>`,
    to,
    subject: 'Reset your Tierdle password',
    text: `Use this link to choose a new password. It works once and expires in 1 hour.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}
