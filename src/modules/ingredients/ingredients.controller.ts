import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../middleware/auth';
import { Ingredient } from './models/Ingredient';
import { Restaurant } from '../auth/models/Restaurant';
import { withStockLevel } from './stockLevel';

/**
 * Resolves the default restaurant for a given tenant.
 * Seeding on-the-fly if it does not already exist.
 */
async function getOrCreateDefaultRestaurant(tenantId: string): Promise<any> {
  let restaurant = await Restaurant.findOne({ tenantId });
  if (!restaurant) {
    restaurant = new Restaurant({
      tenantId,
      name: 'Main Kitchen',
      address: 'Default Address',
      providers: [],
    });
    await restaurant.save();
  }
  return restaurant;
}

export class IngredientsController {
  /**
   * GET /api/ingredients
   * Paginated ingredient list with optional search and sort.
   */
  public async getIngredients(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);

      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '15'), 10) || 15));
      const skip = (page - 1) * limit;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'name-asc';

      const filter: Record<string, unknown> = {
        tenantId,
        restaurantId: restaurant._id,
      };

      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      let sort: Record<string, 1 | -1> = { name: 1 };
      switch (sortBy) {
        case 'name-desc':
          sort = { name: -1 };
          break;
        case 'stock-asc':
          sort = { currentStock: 1 };
          break;
        case 'stock-desc':
          sort = { currentStock: -1 };
          break;
        default:
          sort = { name: 1 };
      }

      const baseFilter = { tenantId, restaurantId: restaurant._id };

      const [ingredients, total, lowStockCount] = await Promise.all([
        Ingredient.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        Ingredient.countDocuments(filter),
        Ingredient.countDocuments({
          ...baseFilter,
          $expr: { $lte: ['$currentStock', '$minThreshold'] },
        }),
      ]);

      return res.status(200).json({
        success: true,
        ingredients: ingredients.map((ingredient) => withStockLevel(ingredient)),
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + ingredients.length < total,
        },
        lowStockCount,
      });
    } catch (error: any) {
      console.error('Get Ingredients Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve ingredients.',
      });
    }
  }

  /**
   * GET /api/ingredients/upload-signature
   * Generate signature credentials for direct frontend upload to Cloudinary.
   */
  public async getUploadSignature(req: AuthenticatedRequest, res: Response) {
    try {
      const apiSecret = process.env.cloudnary_api_scerate;
      const apiKey = process.env.cloudnary_api_key;
      const cloudName = process.env.cloudnary_cloud_name || 'ganeshronghe2';

      if (!apiSecret || !apiKey) {
        return res.status(500).json({ 
          success: false, 
          error: 'Cloudinary configuration is missing on the server. Make sure cloudnary_api_scerate and cloudnary_api_key are set in .env' 
        });
      }

      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = 'ingredients';
      const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;

      const signature = crypto
        .createHash('sha1')
        .update(paramsToSign + apiSecret)
        .digest('hex');

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      return res.status(200).json({
        success: true,
        signature,
        timestamp,
        apiKey,
        uploadUrl,
        folder,
      });
    } catch (error: any) {
      console.error('Get Cloudinary Signature Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate upload signature.',
      });
    }
  }

  /**
   * POST /api/ingredients
   * Create a new ingredient and add its initial batch.
   */
  public async createIngredient(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const { 
        name, 
        minThreshold, 
        purchaseUnit, 
        baseUnit, 
        conversionRatio, 
        initialQuantity, 
        purchaseCost,
        image,
        category
      } = req.body;

      if (!name || minThreshold === undefined || !purchaseUnit || !baseUnit || !conversionRatio) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: name, minThreshold, purchaseUnit, baseUnit, conversionRatio.' 
        });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);

      // Check if ingredient with this name already exists at this restaurant
      const existing = await Ingredient.findOne({ 
        restaurantId: restaurant._id, 
        name: name.trim() 
      });
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          error: 'An ingredient with this name already exists in your inventory.' 
        });
      }

      // Calculate initial stock base values
      const qty = Number(initialQuantity) || 0;
      const cost = Number(purchaseCost) || 0;
      const ratio = Number(conversionRatio) || 1;

      const baseQuantity = qty * ratio;
      const costPerBaseUnit = baseQuantity > 0 ? (cost / baseQuantity) : 0;

      const batches = [];
      if (baseQuantity > 0) {
        batches.push({
          purchaseDate: new Date(),
          originalQuantity: baseQuantity,
          remainingQuantity: baseQuantity,
          costPerBaseUnit: costPerBaseUnit
        });
      }

      const newIngredient = new Ingredient({
        tenantId,
        restaurantId: restaurant._id,
        name: name.trim(),
        category: category || 'Pantry',
        currentStock: baseQuantity,
        minThreshold: Number(minThreshold) || 0,
        unitRelation: {
          purchaseUnit,
          baseUnit,
          conversionRatio: ratio
        },
        batches,
        image: image || null,
        alerts: {
          isAcknowledged: false,
          snoozedUntil: null
        }
      });

      await newIngredient.save();

      return res.status(201).json({
        success: true,
        message: 'Ingredient successfully created.',
        ingredient: withStockLevel(newIngredient.toObject()),
      });
    } catch (error: any) {
      console.error('Create Ingredient Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create ingredient.',
      });
    }
  }

  /**
   * PUT /api/ingredients/:id
   * Update an existing ingredient's details.
   */
  public async updateIngredient(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const { id } = req.params;
      const { 
        name, 
        minThreshold, 
        purchaseUnit, 
        baseUnit, 
        conversionRatio, 
        currentStock, 
        image,
        category,
        purchaseUnitPrice
      } = req.body;

      if (!name || minThreshold === undefined || !purchaseUnit || !baseUnit || !conversionRatio) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: name, minThreshold, purchaseUnit, baseUnit, conversionRatio.' 
        });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);

      const ingredient = await Ingredient.findOne({ 
        _id: id,
        tenantId,
        restaurantId: restaurant._id
      });

      if (!ingredient) {
        return res.status(404).json({ success: false, error: 'Ingredient not found.' });
      }

      // Check name uniqueness (if changed)
      if (name.trim().toLowerCase() !== ingredient.name.toLowerCase()) {
        const existing = await Ingredient.findOne({
          restaurantId: restaurant._id,
          name: name.trim()
        });
        if (existing) {
          return res.status(400).json({ 
            success: false, 
            error: 'An ingredient with this name already exists in your inventory.' 
          });
        }
      }

      // Update fields
      ingredient.name = name.trim();
      if (category !== undefined) {
        ingredient.category = category;
      }
      ingredient.minThreshold = Number(minThreshold) || 0;
      ingredient.unitRelation = {
        purchaseUnit,
        baseUnit,
        conversionRatio: Number(conversionRatio) || 1
      };

      if (image !== undefined) {
        ingredient.image = image;
      }

      if (purchaseUnitPrice !== undefined) {
        const ratio = Number(conversionRatio) || 1;
        const price = Number(purchaseUnitPrice) || 0;
        const costPerBaseUnit = ratio > 0 ? price / ratio : 0;

        if (ingredient.batches.length > 0) {
          ingredient.batches[ingredient.batches.length - 1].costPerBaseUnit = costPerBaseUnit;
        } else if (ingredient.currentStock > 0) {
          ingredient.batches.push({
            purchaseDate: new Date(),
            originalQuantity: ingredient.currentStock,
            remainingQuantity: ingredient.currentStock,
            costPerBaseUnit,
          });
        }
      }

      // If stock is modified, update currentStock and adjust batches
      if (currentStock !== undefined) {
        const newStock = Number(currentStock) || 0;
        ingredient.currentStock = newStock;
        
        // If there's an active batch, adjust it to match the new current stock.
        // Otherwise create a dummy batch so FIFO calculations continue.
        if (ingredient.batches.length > 0) {
          ingredient.batches[ingredient.batches.length - 1].remainingQuantity = newStock;
        } else {
          ingredient.batches.push({
            purchaseDate: new Date(),
            originalQuantity: newStock,
            remainingQuantity: newStock,
            costPerBaseUnit: 0
          });
        }
      }

      await ingredient.save();

      return res.status(200).json({
        success: true,
        message: 'Ingredient successfully updated.',
        ingredient: withStockLevel(ingredient.toObject()),
      });
    } catch (error: any) {
      console.error('Update Ingredient Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to update ingredient.',
      });
    }
  }

  /**
   * DELETE /api/ingredients/:id
   * Delete an existing ingredient.
   */
  public async deleteIngredient(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const { id } = req.params;
      const restaurant = await getOrCreateDefaultRestaurant(tenantId);

      const deleted = await Ingredient.findOneAndDelete({ 
        _id: id,
        tenantId,
        restaurantId: restaurant._id
      });

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Ingredient not found.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Ingredient successfully deleted.',
      });
    } catch (error: any) {
      console.error('Delete Ingredient Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete ingredient.',
      });
    }
  }
}
