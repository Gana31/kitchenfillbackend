import mongoose, { Document, Schema, Types } from 'mongoose';

export type PasswordOtpPurpose = 'forgot_password' | 'change_password';

export interface IPasswordOtp extends Document {
  userId: Types.ObjectId;
  email: string;
  otpHash: string;
  purpose: PasswordOtpPurpose;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const passwordOtpSchema = new Schema<IPasswordOtp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['forgot_password', 'change_password'],
      required: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

passwordOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export const PasswordOtp = mongoose.model<IPasswordOtp>('PasswordOtp', passwordOtpSchema);
