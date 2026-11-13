import type { CartLine, ProductSearchResult } from './types'

export type StockCheck =
  | { level: 'ok' }
  | { level: 'invalid'; message: string }
  | { level: 'error'; message: string }
  | { level: 'warning'; message: string }

// Below or at the minimum warns but allows the sale; above the available stock blocks it
export function checkStock(product: ProductSearchResult, quantity: number): StockCheck {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { level: 'invalid', message: 'Ingresá una cantidad.' }
  }
  const remaining = product.stock - quantity
  if (remaining < 0) {
    return {
      level: 'error',
      message: `Stock insuficiente para la cantidad ingresada (disponible: ${product.stock}).`,
    }
  }
  if (remaining <= product.minStock) {
    return {
      level: 'warning',
      message:
        remaining === 0
          ? 'Atención: con esta venta el stock queda en 0.'
          : `Atención: quedarán ${remaining} (stock mínimo: ${product.minStock}).`,
    }
  }
  return { level: 'ok' }
}

export function isBlocking(check: StockCheck): boolean {
  return check.level === 'error' || check.level === 'invalid'
}

export function hasBlockingLine(lines: CartLine[]): boolean {
  return lines.some((l) => isBlocking(checkStock(l.product, l.quantity)))
}
