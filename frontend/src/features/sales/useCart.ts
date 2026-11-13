import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toCents } from '../../lib/format'
import { roundQuantity } from '../../lib/quantity'
import type { CartLine, ProductSearchResult } from './types'

// Decimal quantities (1,5 m) can produce fractions of a cent; rounded like the backend
export function lineCents({ product, quantity }: CartLine): number {
  return Math.round(toCents(product.salePrice) * quantity)
}

type Action =
  | { type: 'addOne'; product: ProductSearchResult }
  | { type: 'setQuantity'; productId: number; quantity: number }
  | { type: 'remove'; productId: number }
  | { type: 'clear' }

const STORAGE_KEY = 'sales-cart'

function reducer(lines: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'addOne': {
      const existing = lines.find((l) => l.product.id === action.product.id)
      if (!existing) return [...lines, { product: action.product, quantity: 1 }]
      // Refresh the product snapshot so the stock shown is the latest one searched
      return lines.map((l) =>
        l === existing ? { product: action.product, quantity: roundQuantity(l.quantity + 1) } : l,
      )
    }
    case 'setQuantity':
      return lines.map((l) =>
        l.product.id === action.productId ? { ...l, quantity: action.quantity } : l,
      )
    case 'remove':
      return lines.filter((l) => l.product.id !== action.productId)
    case 'clear':
      return []
  }
}

// Persisted so a page refresh in the middle of a sale doesn't lose the cart
function loadCart(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function useCart() {
  const [lines, setLines] = useState(loadCart)
  // Rapid consecutive scans run before React re-renders, so reads must not use a stale `lines`
  const linesRef = useRef(lines)

  const dispatch = useCallback((action: Action) => {
    linesRef.current = reducer(linesRef.current, action)
    setLines(linesRef.current)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const totalCents = useMemo(
    () => lines.reduce((sum, l) => sum + lineCents(l), 0),
    [lines],
  )

  return {
    lines,
    totalCents,
    quantityInCart: (productId: number) =>
      linesRef.current.find((l) => l.product.id === productId)?.quantity ?? 0,
    addOne: (product: ProductSearchResult) => dispatch({ type: 'addOne', product }),
    setQuantity: (productId: number, quantity: number) =>
      dispatch({ type: 'setQuantity', productId, quantity }),
    remove: (productId: number) => dispatch({ type: 'remove', productId }),
    clear: () => dispatch({ type: 'clear' }),
  }
}
