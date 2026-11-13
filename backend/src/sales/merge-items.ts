import type { SaleItemDto } from './dto/create-sale.dto.js';

// Quantities have up to 3 decimals; adding them as integer thousandths avoids float drift (0.1 + 0.2)
const SCALE = 1000;

// The same product scanned twice must be validated against stock as a single line
export function mergeItems(items: SaleItemDto[]): SaleItemDto[] {
  const scaled = new Map<number, number>();
  for (const { productId, quantity } of items) {
    scaled.set(productId, (scaled.get(productId) ?? 0) + Math.round(quantity * SCALE));
  }
  return [...scaled].map(([productId, total]) => ({ productId, quantity: total / SCALE }));
}
