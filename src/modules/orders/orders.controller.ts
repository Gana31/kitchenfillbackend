import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getOrCreateDefaultRestaurant } from '../../shared/restaurant';
import { RecipesService } from '../recipes/recipes.service';
import { Order } from './models/Order';

interface ManualOrderItemInput {
  recipeId?: string;
  portionId?: string;
  itemId?: string;
  name?: string;
  quantity?: number;
  price?: number;
  makingCost?: number;
}

const recipesService = new RecipesService();

export class OrdersController {
  public async createManualOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const { items, commissionCut = 0 } = req.body as {
        items?: ManualOrderItemInput[];
        commissionCut?: number;
      };

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one item is required.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const scope = {
        tenantId: new Types.ObjectId(tenantId),
        restaurantId: restaurant._id as Types.ObjectId,
      };

      const resolvedItems: Array<{
        itemId: string;
        name: string;
        quantity: number;
        price: number;
        makingCost: number;
      }> = [];

      for (const item of items) {
        const quantity = Math.max(1, Number(item.quantity) || 1);

        if (item.recipeId && item.portionId) {
          const match = await recipesService.findPortion(scope, item.recipeId, item.portionId);
          if (!match) {
            return res.status(400).json({
              success: false,
              error: `Recipe portion not found: ${item.recipeId}/${item.portionId}`,
            });
          }

          resolvedItems.push({
            itemId: `${item.recipeId}:${item.portionId}`,
            name: match.portion.name,
            quantity,
            price: match.portion.sellPrice,
            makingCost: match.portion.makingCost,
          });
          continue;
        }

        resolvedItems.push({
          itemId: String(item.itemId || item.name || 'manual-item').trim(),
          name: String(item.name || 'Manual item').trim(),
          quantity,
          price: Math.max(0, Number(item.price) || 0),
          makingCost: Math.max(0, Number(item.makingCost) || 0),
        });
      }

      const grossAmount = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const makingCost = resolvedItems.reduce((sum, item) => sum + item.makingCost * item.quantity, 0);
      const commission = Math.min(100, Math.max(0, Number(commissionCut) || 0));
      const netAmount = grossAmount * (1 - commission / 100);
      const netProfit = netAmount - makingCost;

      const order = await Order.create({
        tenantId: scope.tenantId,
        restaurantId: scope.restaurantId,
        aggregatorOrderId: `MANUAL_${Date.now()}`,
        platform: 'Manual',
        status: 'processed',
        items: resolvedItems.map(({ itemId, name, quantity, price }) => ({
          itemId,
          name,
          quantity,
          price,
        })),
        grossAmount,
        commissionCut: commission,
        netAmount,
        makingCost,
        netProfit,
        processedAt: new Date(),
      });

      return res.status(201).json({
        success: true,
        message: 'Manual sale logged.',
        order,
      });
    } catch (error: any) {
      console.error('Create manual order error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to log manual sale.' });
    }
  }
}
