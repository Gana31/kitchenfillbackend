import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  profilePicture: string | null;
  role: 'Superadmin' | 'Owner' | 'Staff';
  tenantId: Types.ObjectId | null; // Null for Superadmin
  status: 'active' | 'deactivated';
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    enum: ['Superadmin', 'Owner', 'Staff'],
    required: true,
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'deactivated'],
    default: 'active',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const User = model<IUser>('User', userSchema);
export default User;
