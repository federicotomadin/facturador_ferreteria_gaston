import { formatQuantity } from '../../lib/quantity'
import type { ProductSearchResult } from './types'

export function StockBadge({ product }: { product: ProductSearchResult }) {
  if (product.stock <= 0) {
    return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Sin stock</span>
  }
  if (product.stock <= product.minStock) {
    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
        Quedan {formatQuantity(product.stock)}
      </span>
    )
  }
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      Stock {formatQuantity(product.stock)}
    </span>
  )
}
