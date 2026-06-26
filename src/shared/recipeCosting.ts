import { Types } from 'mongoose';
import { Ingredient } from '../modules/ingredients/models/Ingredient';

export function getCostPerBaseUnit(purchasePrice: number, conversionRatio: number): number {
  const ratio = conversionRatio > 0 ? conversionRatio : 1;
  return (purchasePrice || 0) / ratio;
}

export function lineIngredientCost(
  netAmount: number,
  wastagePercent: number,
  costPerBaseUnit: number
): number {
  const grossAmount = netAmount * (1 + wastagePercent / 100);
  return grossAmount * costPerBaseUnit;
}

export interface CustomCostLine {
  label: string;
  amount: number;
}

export interface RecipeCostingInput {
  costingMode: 'weight' | 'piece';
  batchYieldAmount: number;
  batchYieldUnit: 'g' | 'ml' | 'pcs';
  ingredientsUsed: Array<{
    ingredientId: Types.ObjectId | string;
    netAmount: number;
    wastagePercent: number;
  }>;
  makingCharges: {
    fixedAmount: number;
    percentOfIngredients: number;
  };
  customCostLines?: CustomCostLine[];
  extraWastagePercent?: number;
  portions: Array<{
    portionId: string;
    name: string;
    amount: number;
    unit: 'g' | 'ml' | 'pcs';
    sellPrice: number;
  }>;
}

export interface ComputedPortion {
  portionId: string;
  name: string;
  amount: number;
  unit: 'g' | 'ml' | 'pcs';
  sellPrice: number;
  makingCost: number;
  profitPerUnit: number;
}

export interface ComputedRecipeCosting {
  ingredientCost: number;
  extraWastageCost: number;
  customCostTotal: number;
  makingCharges: number;
  batchCost: number;
  batchYieldAmount: number;
  batchYieldUnit: 'g' | 'ml' | 'pcs';
  costingMode: 'weight' | 'piece';
  portions: ComputedPortion[];
}

export async function computeRecipeCosting(
  tenantId: Types.ObjectId,
  restaurantId: Types.ObjectId,
  recipe: RecipeCostingInput
): Promise<ComputedRecipeCosting> {
  let ingredientSubtotal = 0;

  for (const line of recipe.ingredientsUsed) {
    const ingredient = await Ingredient.findOne({
      _id: line.ingredientId,
      tenantId,
      restaurantId,
    }).lean();

    if (!ingredient) continue;

    const ratio = ingredient.unitRelation?.conversionRatio ?? 1;
    const unitCost = getCostPerBaseUnit(ingredient.purchasePrice ?? 0, ratio);
    ingredientSubtotal += lineIngredientCost(line.netAmount, line.wastagePercent, unitCost);
  }

  const extraWastagePercent = Math.max(0, recipe.extraWastagePercent ?? 0);
  const customCostTotal = (recipe.customCostLines ?? []).reduce(
    (sum, line) => sum + Math.max(0, line.amount ?? 0),
    0
  );
  const subtotalBeforeWaste = ingredientSubtotal + customCostTotal;
  const extraWastageCost = subtotalBeforeWaste * (extraWastagePercent / 100);

  const fixed = Math.max(0, recipe.makingCharges?.fixedAmount ?? 0);
  const percent = Math.max(0, recipe.makingCharges?.percentOfIngredients ?? 0);
  const variableCharges = ingredientSubtotal * (percent / 100);
  const makingChargesTotal = fixed + variableCharges;
  const ingredientCost = subtotalBeforeWaste + extraWastageCost;
  const batchCost = ingredientCost + makingChargesTotal;
  const yieldAmount = Math.max(0.001, recipe.batchYieldAmount);

  const portions: ComputedPortion[] = (recipe.portions ?? []).map((portion) => {
    const portionAmount = Math.max(0.001, portion.amount);
    const makingCost = batchCost * (portionAmount / yieldAmount);
    const sellPrice = Math.max(0, portion.sellPrice ?? 0);

    return {
      portionId: portion.portionId,
      name: portion.name,
      amount: portionAmount,
      unit: portion.unit,
      sellPrice,
      makingCost: Math.round(makingCost * 100) / 100,
      profitPerUnit: Math.round((sellPrice - makingCost) * 100) / 100,
    };
  });

  return {
    ingredientCost: Math.round(ingredientCost * 100) / 100,
    extraWastageCost: Math.round(extraWastageCost * 100) / 100,
    customCostTotal: Math.round(customCostTotal * 100) / 100,
    makingCharges: Math.round(makingChargesTotal * 100) / 100,
    batchCost: Math.round(batchCost * 100) / 100,
    batchYieldAmount: recipe.batchYieldAmount,
    batchYieldUnit: recipe.batchYieldUnit,
    costingMode: recipe.costingMode,
    portions,
  };
}
