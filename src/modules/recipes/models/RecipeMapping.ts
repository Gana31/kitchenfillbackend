import { Schema, model, Document, Types } from 'mongoose';

export interface IRecipeIngredient {
  ingredientId: Types.ObjectId; // References Ingredient in ingredients module
  netAmount: number; // In base units
  wastagePercent: number; // e.g. 10 for 10%
}

export interface IProviderPricing {
  platform: 'Zomato' | 'Swiggy' | 'Magicpin' | 'Manual';
  listPrice: number;
  discountPercent: number; // e.g. 10 for 10% discount
}

export interface IRecipeMapping extends Document {
  tenantId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  aggregatorItemId: string; // The item name on the delivery platform
  localName: string; // Local internal name
  ingredientsUsed: IRecipeIngredient[];
  pricingMatrix: IProviderPricing[];
}

const recipeIngredientSchema = new Schema<IRecipeIngredient>({
  ingredientId: {
    type: Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0.001,
  },
  wastagePercent: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
}, { _id: false });

const providerPricingSchema = new Schema<IProviderPricing>({
  platform: {
    type: String,
    enum: ['Zomato', 'Swiggy', 'Magicpin', 'Manual'],
    required: true,
  },
  listPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discountPercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0,
  },
}, { _id: false });

const recipeMappingSchema = new Schema<IRecipeMapping>({
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
  aggregatorItemId: {
    type: String,
    required: true,
    trim: true,
  },
  localName: {
    type: String,
    required: true,
    trim: true,
  },
  ingredientsUsed: {
    type: [recipeIngredientSchema],
    required: true,
    validate: {
      validator: (arr: IRecipeIngredient[]) => arr.length > 0,
      message: 'Recipe mapping must contain at least one ingredient.',
    },
  },
  pricingMatrix: {
    type: [providerPricingSchema],
    default: [],
  },
});

// Enforce unique aggregator menu item names per restaurant
recipeMappingSchema.index({ restaurantId: 1, aggregatorItemId: 1 }, { unique: true });

export const RecipeMapping = model<IRecipeMapping>('RecipeMapping', recipeMappingSchema);
export default RecipeMapping;
