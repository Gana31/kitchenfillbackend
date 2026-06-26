import { Schema, model, Document, Types } from 'mongoose';

export interface IRecipeIngredient {
  ingredientId: Types.ObjectId;
  netAmount: number;
  wastagePercent: number;
}

export interface IRecipePortion {
  portionId: string;
  name: string;
  amount: number;
  unit: 'g' | 'ml' | 'pcs';
  sellPrice: number;
}

export interface IMakingCharges {
  fixedAmount: number;
  percentOfIngredients: number;
}

export interface ICustomCostLine {
  label: string;
  amount: number;
}

export interface IRecipe extends Document {
  tenantId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  costingMode: 'weight' | 'piece';
  batchYieldAmount: number;
  batchYieldUnit: 'g' | 'ml' | 'pcs';
  ingredientsUsed: IRecipeIngredient[];
  makingCharges: IMakingCharges;
  /** Named extras: gas, paper, packaging — not tied to inventory. */
  customCostLines: ICustomCostLine[];
  /** Extra waste % applied on top of ingredient subtotal (spillage, trim, etc.). */
  extraWastagePercent: number;
  portions: IRecipePortion[];
}

const recipeIngredientSchema = new Schema<IRecipeIngredient>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    netAmount: { type: Number, required: true, min: 0.001 },
    wastagePercent: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const recipePortionSchema = new Schema<IRecipePortion>(
  {
    portionId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.001 },
    unit: { type: String, enum: ['g', 'ml', 'pcs'], required: true },
    sellPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const makingChargesSchema = new Schema<IMakingCharges>(
  {
    fixedAmount: { type: Number, required: true, min: 0, default: 0 },
    percentOfIngredients: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const customCostLineSchema = new Schema<ICustomCostLine>(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const recipeSchema = new Schema<IRecipe>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    costingMode: { type: String, enum: ['weight', 'piece'], required: true, default: 'weight' },
    batchYieldAmount: { type: Number, required: true, min: 0.001 },
    batchYieldUnit: { type: String, enum: ['g', 'ml', 'pcs'], required: true, default: 'g' },
    ingredientsUsed: {
      type: [recipeIngredientSchema],
      required: true,
      validate: {
        validator: (arr: IRecipeIngredient[]) => arr.length > 0,
        message: 'Recipe must include at least one ingredient.',
      },
    },
    makingCharges: { type: makingChargesSchema, required: true, default: () => ({ fixedAmount: 0, percentOfIngredients: 0 }) },
    customCostLines: { type: [customCostLineSchema], default: [] },
    extraWastagePercent: { type: Number, required: true, min: 0, default: 0 },
    portions: {
      type: [recipePortionSchema],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

recipeSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export const Recipe = model<IRecipe>('Recipe', recipeSchema);
export default Recipe;
