import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from './models/User';
import { PasswordOtp, IPasswordOtp, PasswordOtpPurpose } from './models/PasswordOtp';
import { RefreshToken } from './models/RefreshToken';
import { sendPasswordOtpEmail } from '../../shared/mail/mailer';

const OTP_EXPIRY_MINUTES = 10;
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT_MAX = 5;
const MIN_PASSWORD_LENGTH = 6;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function validateNewPassword(password: string): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

async function assertOtpRateLimit(email: string, purpose: PasswordOtpPurpose): Promise<void> {
  const since = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS);
  const recentCount = await PasswordOtp.countDocuments({
    email,
    purpose,
    createdAt: { $gte: since },
  });

  if (recentCount >= OTP_RATE_LIMIT_MAX) {
    throw new Error('Too many OTP requests. Please wait a few minutes and try again.');
  }
}

async function createAndSendOtp(user: { _id: any; email: string; name: string }, purpose: PasswordOtpPurpose): Promise<void> {
  const email = normalizeEmail(user.email);
  await assertOtpRateLimit(email, purpose);

  const otp = generateOtpCode();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await PasswordOtp.updateMany(
    { email, purpose, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  await PasswordOtp.create({
    userId: user._id,
    email,
    otpHash,
    purpose,
    expiresAt,
    usedAt: null,
  });

  const purposeLabel =
    purpose === 'forgot_password' ? 'reset your password' : 'update your password';

  await sendPasswordOtpEmail({
    to: email,
    recipientName: user.name,
    otp,
    purposeLabel,
    expiresMinutes: OTP_EXPIRY_MINUTES,
  });
}

async function verifyOtp(email: string, otp: string, purpose: PasswordOtpPurpose) {
  const normalizedEmail = normalizeEmail(email);
  const otpRecord = await PasswordOtp.findOne({
    email: normalizedEmail,
    purpose,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new Error('Invalid or expired OTP. Please request a new code.');
  }

  const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
  if (!isValid) {
    throw new Error('Invalid OTP. Please check the code and try again.');
  }

  return otpRecord;
}

async function applyNewPassword(userId: string, newPassword: string, otpRecord: IPasswordOtp): Promise<void> {
  validateNewPassword(newPassword);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(userId, { passwordHash });
  otpRecord.usedAt = new Date();
  await otpRecord.save();

  await RefreshToken.updateMany({ userId }, { isRevoked: true });
}

export class PasswordService {
  public async sendForgotPasswordOtp(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new Error('This email is not registered. Please sign up or check your email address.');
    }

    await createAndSendOtp(user, 'forgot_password');
  }

  public async resetPasswordWithOtp(email: string, otp: string, newPassword: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new Error('This email is not registered.');
    }

    const otpRecord = await verifyOtp(normalizedEmail, otp, 'forgot_password');
    await applyNewPassword(user._id.toString(), newPassword, otpRecord);
  }

  public async sendChangePasswordOtp(userId: string): Promise<{ email: string }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User account not found.');
    }

    await createAndSendOtp(user, 'change_password');
    return { email: user.email };
  }

  public async changePasswordWithOtp(userId: string, otp: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User account not found.');
    }

    const otpRecord = await verifyOtp(user.email, otp, 'change_password');
    if (otpRecord.userId.toString() !== user._id.toString()) {
      throw new Error('Invalid OTP for this account.');
    }

    await applyNewPassword(user._id.toString(), newPassword, otpRecord);
  }
}
