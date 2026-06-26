import { Types } from 'mongoose';
import { Order } from '../orders/models/Order';
import { Ingredient } from '../ingredients/models/Ingredient';
import { formatDateKey, getUtcDayRange, parseDateParam } from '../../shared/restaurant';

interface RestaurantScope {
  tenantId: Types.ObjectId;
  restaurantId: Types.ObjectId;
}

function buildOrderDateFilter(start: Date, end: Date) {
  return {
    status: 'processed' as const,
    processedAt: { $gte: start, $lte: end },
  };
}

export class AnalyticsService {
  async getDailySummary(scope: RestaurantScope, dateInput?: string) {
    const day = parseDateParam(dateInput);
    const { start, end } = getUtcDayRange(day);
    const baseFilter = {
      tenantId: scope.tenantId,
      restaurantId: scope.restaurantId,
      ...buildOrderDateFilter(start, end),
    };

    const [orderStats, lowStockCount] = await Promise.all([
      Order.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            grossRevenue: { $sum: '$grossAmount' },
            netRevenue: { $sum: '$netAmount' },
            makingCost: { $sum: '$makingCost' },
            netProfit: { $sum: '$netProfit' },
            orderCount: { $sum: 1 },
          },
        },
      ]),
      Ingredient.countDocuments({
        tenantId: scope.tenantId,
        restaurantId: scope.restaurantId,
        $expr: { $lte: ['$currentStock', '$minThreshold'] },
      }),
    ]);

    const stats = orderStats[0] ?? {
      grossRevenue: 0,
      netRevenue: 0,
      makingCost: 0,
      netProfit: 0,
      orderCount: 0,
    };

    const marginPercent =
      stats.netRevenue > 0 ? Math.round((stats.netProfit / stats.netRevenue) * 1000) / 10 : 0;

    return {
      date: formatDateKey(day),
      grossRevenue: stats.grossRevenue,
      netRevenue: stats.netRevenue,
      makingCost: stats.makingCost,
      netProfit: stats.netProfit,
      marginPercent,
      orderCount: stats.orderCount,
      lowStockCount,
    };
  }

  async getTopPlates(scope: RestaurantScope, dateInput?: string, limit = 5) {
    const day = parseDateParam(dateInput);
    const { start, end } = getUtcDayRange(day);

    const rows = await Order.aggregate([
      {
        $match: {
          tenantId: scope.tenantId,
          restaurantId: scope.restaurantId,
          ...buildOrderDateFilter(start, end),
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          quantitySold: { $sum: '$items.quantity' },
          grossRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { grossRevenue: -1 } },
      { $limit: limit },
    ]);

    return rows.map((row) => ({
      name: row._id as string,
      quantitySold: row.quantitySold as number,
      grossRevenue: row.grossRevenue as number,
    }));
  }

  async getPlatformComparison(scope: RestaurantScope, dateInput?: string) {
    const day = parseDateParam(dateInput);
    const { start, end } = getUtcDayRange(day);

    const rows = await Order.aggregate([
      {
        $match: {
          tenantId: scope.tenantId,
          restaurantId: scope.restaurantId,
          ...buildOrderDateFilter(start, end),
        },
      },
      {
        $group: {
          _id: '$platform',
          gross: { $sum: '$grossAmount' },
          net: { $sum: '$netAmount' },
          profit: { $sum: '$netProfit' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { gross: -1 } },
    ]);

    return rows.map((row) => ({
      platform: row._id as string,
      gross: row.gross as number,
      net: row.net as number,
      profit: row.profit as number,
      orderCount: row.orderCount as number,
    }));
  }

  async getSalesTrend(scope: RestaurantScope, startInput?: string, endInput?: string) {
    const endDay = parseDateParam(endInput);
    const startDay = startInput
      ? parseDateParam(startInput)
      : new Date(endDay.getTime() - 6 * 24 * 60 * 60 * 1000);

    const { start } = getUtcDayRange(startDay);
    const { end } = getUtcDayRange(endDay);

    const rows = await Order.aggregate([
      {
        $match: {
          tenantId: scope.tenantId,
          restaurantId: scope.restaurantId,
          status: 'processed',
          processedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$processedAt' },
          },
          gross: { $sum: '$grossAmount' },
          net: { $sum: '$netAmount' },
          profit: { $sum: '$netProfit' },
          makingCost: { $sum: '$makingCost' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byDate = new Map(rows.map((row) => [row._id as string, row]));
    const trend: Array<{
      date: string;
      gross: number;
      net: number;
      profit: number;
      makingCost: number;
      orders: number;
    }> = [];

    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = formatDateKey(cursor);
      const row = byDate.get(key);
      trend.push({
        date: key,
        gross: (row?.gross as number) ?? 0,
        net: (row?.net as number) ?? 0,
        profit: (row?.profit as number) ?? 0,
        makingCost: (row?.makingCost as number) ?? 0,
        orders: (row?.orders as number) ?? 0,
      });
    }

    return trend;
  }
}
