import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../middleware/auth';
import { Ingredient } from './models/Ingredient';
import { Restaurant } from '../auth/models/Restaurant';
import { withStockLevel } from './stockLevel';

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
  public async getIngredients(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);

      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'name-asc';
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '15'), 10) || 15));
      const skip = (page - 1) * limit;

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

  public async getUploadSignature(req: AuthenticatedRequest, res: Response) {
    try {
      const apiSecret = process.env.cloudnary_api_scerate;
      const apiKey = process.env.cloudnary_api_key;
      const cloudName = process.env.cloudnary_cloud_name || 'ganeshronghe2';

      if (!apiSecret || !apiKey) {
        return res.status(500).json({
          success: false,
          error: 'Cloudinary configuration is missing on the server. Make sure cloudnary_api_scerate and cloudnary_api_key are set in .env',
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
        purchasePrice,
        image,
        category,
      } = req.body;

      if (!name || minThreshold === undefined || !purchaseUnit || !baseUnit || !conversionRatio) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, minThreshold, purchaseUnit, baseUnit, conversionRatio.',
        });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);

      const existing = await Ingredient.findOne({
        restaurantId: restaurant._id,
        name: name.trim(),
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'An ingredient with this name already exists in your inventory.',
        });
      }

      const qty = Number(initialQuantity) || 0;
      const ratio = Number(conversionRatio) || 1;
      const baseQuantity = qty * ratio;
      const price = Number(purchasePrice ?? purchaseCost) || 0;

      const newIngredient = new Ingredient({
        tenantId,
        restaurantId: restaurant._id,
        name: name.trim(),
        category: category || 'Pantry',
        currentStock: baseQuantity,
        minThreshold: Number(minThreshold) || 0,
        purchasePrice: price,
        unitRelation: {
          purchaseUnit,
          baseUnit,
          conversionRatio: ratio,
        },
        image: image || null,
        alerts: {
          isAcknowledged: false,
          snoozedUntil: null,
        },
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
        purchasePrice,
        purchaseUnitPrice,
        purchaseCost,
      } = req.body;

      const hasUpdate =
        name !== undefined ||
        minThreshold !== undefined ||
        purchaseUnit !== undefined ||
        baseUnit !== undefined ||
        conversionRatio !== undefined ||
        currentStock !== undefined ||
        image !== undefined ||
        category !== undefined ||
        purchasePrice !== undefined ||
        purchaseUnitPrice !== undefined ||
        purchaseCost !== undefined;

      if (!hasUpdate) {
        return res.status(400).json({ success: false, error: 'No fields to update.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);

      const ingredient = await Ingredient.findOne({
        _id: id,
        tenantId,
        restaurantId: restaurant._id,
      });

      if (!ingredient) {
        return res.status(404).json({ success: false, error: 'Ingredient not found.' });
      }

      if (name !== undefined) {
        const trimmed = String(name).trim();
        if (!trimmed) {
          return res.status(400).json({ success: false, error: 'Name cannot be empty.' });
        }
        if (trimmed.toLowerCase() !== ingredient.name.toLowerCase()) {
          const existing = await Ingredient.findOne({
            restaurantId: restaurant._id,
            name: trimmed,
          });
          if (existing) {
            return res.status(400).json({
              success: false,
              error: 'An ingredient with this name already exists in your inventory.',
            });
          }
        }
        ingredient.name = trimmed;
      }

      if (category !== undefined) {
        ingredient.category = category;
      }

      if (minThreshold !== undefined) {
        ingredient.minThreshold = Math.max(0, Number(minThreshold) || 0);
      }

      if (
        purchaseUnit !== undefined ||
        baseUnit !== undefined ||
        conversionRatio !== undefined
      ) {
        ingredient.unitRelation = {
          purchaseUnit: purchaseUnit ?? ingredient.unitRelation.purchaseUnit,
          baseUnit: baseUnit ?? ingredient.unitRelation.baseUnit,
          conversionRatio:
            conversionRatio !== undefined
              ? Math.max(1, Number(conversionRatio) || 1)
              : ingredient.unitRelation.conversionRatio,
        };
      }

      if (image !== undefined) {
        ingredient.image = image;
      }

      const priceInput = purchasePrice ?? purchaseUnitPrice ?? purchaseCost;
      if (priceInput !== undefined) {
        ingredient.purchasePrice = Math.max(0, Number(priceInput) || 0);
      }

      if (currentStock !== undefined) {
        ingredient.currentStock = Math.max(0, Number(currentStock) || 0);
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
        restaurantId: restaurant._id,
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

  /**
   * PATCH /api/ingredients/:id/stock
   * Fast stock bump. Optional purchasePrice updates the single stored price.
   */
  public async adjustStock(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const { id } = req.params;
      const delta = Number(req.body?.delta);
      const purchasePrice = req.body?.purchasePrice;

      if (!Number.isFinite(delta) || delta === 0) {
        return res.status(400).json({ success: false, error: 'A non-zero numeric delta is required.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const baseFilter = { tenantId, restaurantId: restaurant._id };

      const pipeline: Record<string, unknown>[] = [
        {
          $set: {
            currentStock: {
              $max: [0, { $add: ['$currentStock', delta] }],
            },
          },
        },
      ];

      if (purchasePrice !== undefined && Number.isFinite(Number(purchasePrice))) {
        pipeline.push({
          $set: {
            purchasePrice: Math.max(0, Number(purchasePrice)),
          },
        });
      }

      const ingredient = await Ingredient.findOneAndUpdate(
        { _id: id, ...baseFilter },
        pipeline,
        { new: true, lean: true }
      );

      if (!ingredient) {
        return res.status(404).json({ success: false, error: 'Ingredient not found.' });
      }

      const lowStockCount = await Ingredient.countDocuments({
        ...baseFilter,
        $expr: { $lte: ['$currentStock', '$minThreshold'] },
      });

      return res.status(200).json({
        success: true,
        message: 'Stock updated.',
        ingredient: withStockLevel(ingredient),
        lowStockCount,
      });
    } catch (error: any) {
      console.error('Adjust stock error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to adjust stock.',
      });
    }
  }
}
