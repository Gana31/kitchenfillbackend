import { Restaurant } from '../modules/auth/models/Restaurant';

export async function getOrCreateDefaultRestaurant(tenantId: string) {
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

export function parseDateParam(value: unknown, fallback = new Date()): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(fallback);
}

export function getUtcDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
