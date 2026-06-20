export type StockLevel = 'low' | 'average' | 'high';

/** Average band ends at 2× the minimum threshold; above that is considered high stock. */
const AVERAGE_STOCK_MULTIPLIER = 2;

export function computeStockLevel(currentStock: number, minThreshold: number): StockLevel {
  if (currentStock <= minThreshold) {
    return 'low';
  }

  if (minThreshold <= 0) {
    return currentStock > 0 ? 'high' : 'low';
  }

  if (currentStock <= minThreshold * AVERAGE_STOCK_MULTIPLIER) {
    return 'average';
  }

  return 'high';
}

export function withStockLevel<T extends { currentStock: number; minThreshold: number }>(
  ingredient: T
): T & { stockLevel: StockLevel } {
  return {
    ...ingredient,
    stockLevel: computeStockLevel(ingredient.currentStock, ingredient.minThreshold),
  };
}
