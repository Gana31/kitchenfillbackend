import { Schema, model, Document, Types } from 'mongoose';

export interface IUnitRelation {
  purchaseUnit: 'kg' | 'liter' | 'pack';
  baseUnit: 'g' | 'ml' | 'pcs';
  conversionRatio: number; // e.g. 1000 for kg->g, 30 for pack->pcs
}

export interface IIngredientAlert {
  isAcknowledged: boolean;
  snoozedUntil: Date | null;
}

export interface IIngredient extends Document {
  tenantId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  category?: string;
  currentStock: number; // In base units (g, ml, pcs)
  minThreshold: number; // In base units
  unitRelation: IUnitRelation;
  /** Price per purchase unit (₹/kg, ₹/liter, ₹/pack). Updated when you buy at a new rate. */
  purchasePrice: number;
  alerts: IIngredientAlert;
  image?: string | null;
}

const unitRelationSchema = new Schema<IUnitRelation>({
  purchaseUnit: { type: String, enum: ['kg', 'liter', 'pack'], required: true },
  baseUnit: { type: String, enum: ['g', 'ml', 'pcs'], required: true },
  conversionRatio: { type: Number, required: true, min: 1 },
}, { _id: false });

const ingredientSchema = new Schema<IIngredient>({
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
  name: {
    type: String,
    required: true,
    trim: true,
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  minThreshold: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  unitRelation: {
    type: unitRelationSchema,
    required: true,
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  alerts: {
    isAcknowledged: { type: Boolean, default: false, required: true },
    snoozedUntil: { type: Date, default: null },
  },
  image: {
    type: String,
    default: null,
  },
  category: {
    type: String,
    default: 'Pantry',
  },
});

ingredientSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export const Ingredient = model<IIngredient>('Ingredient', ingredientSchema);
export default Ingredient;
