import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getOrCreateDefaultRestaurant } from '../../shared/restaurant';
import { AnalyticsService } from './analytics.service';

const service = new AnalyticsService();

export class AnalyticsController {
  public async getDailySummary(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const scope = {
        tenantId: new Types.ObjectId(tenantId),
        restaurantId: restaurant._id,
      };

      const summary = await service.getDailySummary(scope, req.query.date as string | undefined);

      return res.status(200).json({ success: true, summary });
    } catch (error: any) {
      console.error('Analytics daily summary error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to load daily summary.' });
    }
  }

  public async getTopPlates(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '5'), 10) || 5));
      const topPlates = await service.getTopPlates(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        req.query.date as string | undefined,
        limit
      );

      return res.status(200).json({ success: true, topPlates });
    } catch (error: any) {
      console.error('Analytics top plates error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to load top plates.' });
    }
  }

  public async getPlatformComparison(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const comparison = await service.getPlatformComparison(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        req.query.date as string | undefined
      );

      return res.status(200).json({ success: true, comparison });
    } catch (error: any) {
      console.error('Analytics platform comparison error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to load platform comparison.' });
    }
  }

  public async getSalesTrend(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' });
      }

      const restaurant = await getOrCreateDefaultRestaurant(tenantId);
      const trend = await service.getSalesTrend(
        { tenantId: new Types.ObjectId(tenantId), restaurantId: restaurant._id },
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      return res.status(200).json({ success: true, trend });
    } catch (error: any) {
      console.error('Analytics sales trend error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to load sales trend.' });
    }
  }
}
