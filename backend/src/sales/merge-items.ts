import type { SaleItemDto } from './dto/create-sale.dto.js';

// The same product scanned twice must be validated against stock as a single line
export function mergeItems(items: SaleItemDto[]): SaleItemDto[] {
  const quantities = new Map<number, number>();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}
