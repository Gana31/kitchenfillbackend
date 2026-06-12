import { Schema, model, Document, Types } from 'mongoose';

export interface IProviderConfig {
  providerName: 'Zomato' | 'Swiggy' | 'Magicpin' | 'Other';
  providerStorefrontId: string;
  commissionRate: number; // Defaults to e.g., 30 for 30% cut
  isActive: boolean;
}

export interface IRestaurant extends Document {
  tenantId: Types.ObjectId; // References parent Tenant
  name: string; // Outlet Name
  address: string; // Outlet physical address
  providers: IProviderConfig[];
  createdAt: Date;
}

const providerConfigSchema = new Schema<IProviderConfig>({
  providerName: {
    type: String,
    enum: ['Zomato', 'Swiggy', 'Magicpin', 'Other'],
    required: true,
  },
  providerStorefrontId: {
    type: String,
    required: true,
    trim: true,
  },
  commissionRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 30,
  },
  isActive: {
    type: Boolean,
    default: true,
    required: true,
  },
}, { _id: false });

const restaurantSchema = new Schema<IRestaurant>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  providers: {
    type: [providerConfigSchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Enforce unique restaurant names within a tenant
restaurantSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Restaurant = model<IRestaurant>('Restaurant', restaurantSchema);
export default Restaurant;
