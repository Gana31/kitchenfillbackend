import { Types } from 'mongoose';
import { Recipe, IRecipe } from './models/Recipe';
import { computeRecipeCosting } from '../../shared/recipeCosting';

interface RestaurantScope {
  tenantId: Types.ObjectId;
  restaurantId: Types.ObjectId;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class RecipesService {
  async listWithCosting(scope: RestaurantScope) {
    const recipes = await Recipe.find({
      tenantId: scope.tenantId,
      restaurantId: scope.restaurantId,
    })
      .sort({ name: 1 })
      .lean();

    return Promise.all(
      recipes.map(async (recipe) => {
        const costing = await computeRecipeCosting(scope.tenantId, scope.restaurantId, {
          costingMode: recipe.costingMode,
          batchYieldAmount: recipe.batchYieldAmount,
          batchYieldUnit: recipe.batchYieldUnit,
          ingredientsUsed: recipe.ingredientsUsed,
          makingCharges: recipe.makingCharges,
          customCostLines: recipe.customCostLines ?? [],
          extraWastagePercent: recipe.extraWastagePercent ?? 0,
          portions: recipe.portions,
        });

        return {
          ...recipe,
          costing,
        };
      })
    );
  }

  async getCounterMenu(scope: RestaurantScope) {
    const recipes = await this.listWithCosting(scope);
    const items: Array<{
      recipeId: string;
      portionId: string;
      itemId: string;
      name: string;
      recipeName: string;
      price: number;
      makingCost: number;
      profitPerUnit: number;
      costingMode: 'weight' | 'piece';
      portionLabel: string;
    }> = [];

    for (const recipe of recipes) {
      for (const portion of recipe.costing.portions) {
        const portionLabel =
          recipe.costingMode === 'weight'
            ? `${portion.amount}${portion.unit}`
            : `${portion.amount} pc`;

        items.push({
          recipeId: String(recipe._id),
          portionId: portion.portionId,
          itemId: `${recipe._id}:${portion.portionId}`,
          name: portion.name,
          recipeName: recipe.name,
          price: portion.sellPrice,
          makingCost: portion.makingCost,
          profitPerUnit: portion.profitPerUnit,
          costingMode: recipe.costingMode,
          portionLabel,
        });
      }
    }

    return items;
  }

  async findPortion(scope: RestaurantScope, recipeId: string, portionId: string) {
    const recipe = await Recipe.findOne({
      _id: recipeId,
      tenantId: scope.tenantId,
      restaurantId: scope.restaurantId,
    }).lean();

    if (!recipe) return null;

    const costing = await computeRecipeCosting(scope.tenantId, scope.restaurantId, {
      costingMode: recipe.costingMode,
      batchYieldAmount: recipe.batchYieldAmount,
      batchYieldUnit: recipe.batchYieldUnit,
      ingredientsUsed: recipe.ingredientsUsed,
      makingCharges: recipe.makingCharges,
      customCostLines: recipe.customCostLines ?? [],
      extraWastagePercent: recipe.extraWastagePercent ?? 0,
      portions: recipe.portions,
    });

    const portion = costing.portions.find((row) => row.portionId === portionId);
    if (!portion) return null;

    return { recipe, costing, portion };
  }

  async previewCost(scope: RestaurantScope, payload: Partial<IRecipe>) {
    return computeRecipeCosting(scope.tenantId, scope.restaurantId, {
      costingMode: payload.costingMode ?? 'weight',
      batchYieldAmount: payload.batchYieldAmount ?? 1,
      batchYieldUnit: payload.batchYieldUnit ?? 'g',
      ingredientsUsed: payload.ingredientsUsed ?? [],
      makingCharges: payload.makingCharges ?? { fixedAmount: 0, percentOfIngredients: 0 },
      customCostLines: payload.customCostLines ?? [],
      extraWastagePercent: payload.extraWastagePercent ?? 0,
      portions: payload.portions ?? [],
    });
  }

  async create(scope: RestaurantScope, payload: Partial<IRecipe>) {
    const batchYieldAmount = payload.batchYieldAmount ?? 1;
    const batchYieldUnit = payload.batchYieldUnit ?? 'g';

    let portions = (payload.portions ?? []).map((portion) => ({
      ...portion,
      portionId: portion.portionId || slugify(portion.name),
    }));

    if (portions.length === 0) {
      portions = [
        {
          portionId: 'full-batch',
          name: 'Full batch',
          amount: batchYieldAmount,
          unit: batchYieldUnit,
          sellPrice: 0,
        },
      ];
    }

    const recipe = await Recipe.create({
      tenantId: scope.tenantId,
      restaurantId: scope.restaurantId,
      name: payload.name?.trim(),
      costingMode: payload.costingMode ?? 'weight',
      batchYieldAmount,
      batchYieldUnit,
      ingredientsUsed: payload.ingredientsUsed,
      makingCharges: payload.makingCharges ?? { fixedAmount: 0, percentOfIngredients: 0 },
      customCostLines: payload.customCostLines ?? [],
      extraWastagePercent: payload.extraWastagePercent ?? 0,
      portions,
    });

    return recipe;
  }

  async update(scope: RestaurantScope, id: string, payload: Partial<IRecipe>) {
    const update: Record<string, unknown> = { ...payload };
    if (Array.isArray(payload.portions)) {
      update.portions = payload.portions.map((portion) => ({
        ...portion,
        portionId: portion.portionId || slugify(portion.name),
      }));
    }

    return Recipe.findOneAndUpdate(
      { _id: id, tenantId: scope.tenantId, restaurantId: scope.restaurantId },
      update,
      { new: true, runValidators: true }
    ).lean();
  }

  async remove(scope: RestaurantScope, id: string) {
    return Recipe.findOneAndDelete({
      _id: id,
      tenantId: scope.tenantId,
      restaurantId: scope.restaurantId,
    });
  }
}

export default RecipesService;
