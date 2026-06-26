import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getOrCreateDefaultRestaurant } from '../../shared/restaurant';
import { RecipesService } from './recipes.service';

const service = new RecipesService();

export class RecipesController {
  public async getRecipes(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const recipes = await service.listWithCosting({
        tenantId: new Types.ObjectId(tenantId),
        restaurantId: restaurant._id,
      });

      return res.status(200).json({ success: true, recipes });
    } catch (error: any) {
      console.error('Get recipes error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to load recipes.' });
    }
  }

  public async getCounterMenu(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const items = await service.getCounterMenu({
        tenantId: new Types.ObjectId(tenantId),
        restaurantId: restaurant._id,
      });

      return res.status(200).json({ success: true, items });
    } catch (error: any) {
      console.error('Get counter menu error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to load counter menu.' });
    }
  }

  public async previewRecipeCost(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const costing = await service.previewCost(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        req.body
      );

      return res.status(200).json({ success: true, costing });
    } catch (error: any) {
      console.error('Preview recipe cost error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to preview cost.' });
    }
  }

  public async createRecipe(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const {
        name,
        costingMode,
        batchYieldAmount,
        batchYieldUnit,
        ingredientsUsed,
        makingCharges,
        customCostLines,
        extraWastagePercent,
        portions,
      } = req.body;

      if (!name || !batchYieldAmount || !Array.isArray(ingredientsUsed)) {
        return res.status(400).json({
          success: false,
          error: 'Required: name, batchYieldAmount, ingredientsUsed.',
        });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const recipe = await service.create(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        {
          name,
          costingMode,
          batchYieldAmount,
          batchYieldUnit,
          ingredientsUsed,
          makingCharges,
          customCostLines,
          extraWastagePercent,
          portions: Array.isArray(portions) ? portions : [],
        }
      );

      const costing = await service.previewCost(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        recipe.toObject()
      );

      return res.status(201).json({ success: true, message: 'Recipe created.', recipe, costing });
    } catch (error: any) {
      console.error('Create recipe error:', error);
      if (error?.code === 11000) {
        return res.status(400).json({ success: false, error: 'A recipe with this name already exists.' });
      }
      return res.status(500).json({ success: false, error: error.message || 'Failed to create recipe.' });
    }
  }

  public async updateRecipe(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const recipe = await service.update(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        req.params.id,
        req.body
      );

      if (!recipe) {
        return res.status(404).json({ success: false, error: 'Recipe not found.' });
      }

      return res.status(200).json({ success: true, message: 'Recipe updated.', recipe });
    } catch (error: any) {
      console.error('Update recipe error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to update recipe.' });
    }
  }

  public async deleteRecipe(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const deleted = await service.remove(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        req.params.id
      );

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Recipe not found.' });
      }

      return res.status(200).json({ success: true, message: 'Recipe deleted.' });
    } catch (error: any) {
      console.error('Delete recipe error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to delete recipe.' });
    }
  }
}
