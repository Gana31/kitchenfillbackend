import nodemailer from 'nodemailer';
import {
  buildPasswordOtpEmailHtml,
  buildPasswordOtpEmailText,
} from './passwordResetEmailTemplate';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_MAIL = process.env.SMTP_MAIL || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!SMTP_MAIL || !SMTP_PASSWORD) {
    throw new Error('Email service is not configured. Set SMTP_MAIL and SMTP_PASSWORD.');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_MAIL,
        pass: SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

export async function sendPasswordOtpEmail(params: {
  to: string;
  recipientName: string;
  otp: string;
  purposeLabel: string;
  expiresMinutes: number;
}): Promise<void> {
  const { to, recipientName, otp, purposeLabel, expiresMinutes } = params;
  const transport = getTransporter();

  await transport.sendMail({
    from: `"KitchenFill" <${SMTP_MAIL}>`,
    to,
    subject: `${otp} is your KitchenFill verification code`,
    text: buildPasswordOtpEmailText({ recipientName, otp, purposeLabel, expiresMinutes }),
    html: buildPasswordOtpEmailHtml({ recipientName, otp, purposeLabel, expiresMinutes }),
  });
}
