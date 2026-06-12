import { Schema, model, Document, Types } from 'mongoose';

export interface ITenant extends Document {
  businessName: string;
  ownerId: Types.ObjectId; // References the Owner (User)
  status: 'active' | 'deactivated';
  createdAt: Date;
}

const tenantSchema = new Schema<ITenant>({
  businessName: {
    type: String,
    required: true,
    trim: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
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
    required: true,
  },
});

export const Tenant = model<ITenant>('Tenant', tenantSchema);
export default Tenant;
