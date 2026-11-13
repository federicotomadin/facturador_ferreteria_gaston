import { apiFetch } from '../../lib/api'
import type { CartLine, ProductSearchResult, Sale } from './types'

export function searchProducts(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: '20' })
  return apiFetch<ProductSearchResult[]>(`/products/search?${params}`, { signal })
}

export function createSale(lines: CartLine[]) {
  return apiFetch<Sale>('/sales', {
    method: 'POST',
    body: JSON.stringify({
      items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
    }),
  })
}
