import { Schema, model, Document, Types } from 'mongoose';

export interface IOrderItem {
  itemId: string; // References RecipeMapping aggregatorItemId
  name: string; // Item name from provider
  quantity: number;
  price: number; // Price per item paid by customer after discounts
}

export interface IOrder extends Document {
  tenantId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  aggregatorOrderId: string; // Unique order ID from Zomato/Swiggy/Magicpin or MANUAL_timestamp
  platform: 'Zomato' | 'Swiggy' | 'Magicpin' | 'Manual';
  status: 'pending' | 'processed' | 'failed';
  items: IOrderItem[];
  grossAmount: number; // Selling price sum (after discount, before platform commission)
  commissionCut: number; // Platform cut fee percent (e.g., 30 for Zomato)
  netAmount: number; // Net payout after aggregator fee
  makingCost: number; // COGS from ingredient purchasePrice at time of sale
  netProfit: number; // netAmount - makingCost
  processedAt: Date;
  errorMessage?: string;
}

const orderItemSchema = new Schema<IOrderItem>({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderSchema = new Schema<IOrder>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true,
  },
  aggregatorOrderId: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    enum: ['Zomato', 'Swiggy', 'Magicpin', 'Manual'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: 'pending',
    required: true,
  },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: (arr: IOrderItem[]) => arr.length > 0,
      message: 'Order must contain at least one item.',
    },
  },
  grossAmount: { type: Number, required: true, min: 0 },
  commissionCut: { type: Number, required: true, min: 0, max: 100, default: 0 },
  netAmount: { type: Number, required: true, min: 0 },
  makingCost: { type: Number, required: true, min: 0, default: 0 },
  netProfit: { type: Number, required: true, default: 0 },
  processedAt: { type: Date, default: Date.now },
  errorMessage: { type: String },
});

// Enforce unique aggregatorOrderId per platform per tenant
orderSchema.index({ tenantId: 1, platform: 1, aggregatorOrderId: 1 }, { unique: true });

export const Order = model<IOrder>('Order', orderSchema);
export default Order;
