import { Schema, model, Document, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  replacedByToken?: string; // Tracks token rotation history
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isRevoked: {
    type: Boolean,
    default: false,
    required: true,
  },
  replacedByToken: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
export default RefreshToken;
