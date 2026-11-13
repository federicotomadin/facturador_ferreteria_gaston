import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { formatQuantity } from '../../lib/quantity'
import { Cart } from './Cart'
import { ProductSearch } from './ProductSearch'
import { createSale } from './api'
import { checkStock, hasBlockingLine } from './stock-check'
import type { ProductSearchResult, Sale } from './types'
import { useCart } from './useCart'

type Notice = { kind: 'error'; text: string } | { kind: 'success'; sale: Sale }

function saleErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'Stock insuficiente para la cantidad ingresada en uno de los productos (pudo cambiar desde que lo agregaste). Volvé a escanearlo para ver el stock actual.'
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'Algún producto de la cesta ya no está disponible. Quitalo y volvé a intentar.'
  }
  return 'No se pudo registrar la venta. Revisá la conexión e intentá de nuevo; la cesta se mantiene.'
}

export function SalesPage() {
  const cart = useCart()
  const searchRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const addProduct = (product: ProductSearchResult) => {
    const check = checkStock(product, cart.quantityInCart(product.id) + 1)
    if (check.level === 'error') {
      setNotice({ kind: 'error', text: `${product.description}: ${check.message}` })
      return
    }
    setNotice(null)
    cart.addOne(product)
  }

  const confirmSale = useCallback(async () => {
    if (!cart.lines.length || hasBlockingLine(cart.lines) || submitting) return
    setSubmitting(true)
    setNotice(null)
    try {
      const sale = await createSale(cart.lines)
      cart.clear()
      setNotice({ kind: 'success', sale })
    } catch (error) {
      setNotice({ kind: 'error', text: saleErrorMessage(error) })
    } finally {
      setSubmitting(false)
      searchRef.current?.focus()
    }
  }, [cart, submitting])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'F9') {
        event.preventDefault()
        void confirmSale()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmSale])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <section>
        <h1 className="mb-3 text-2xl font-semibold">Venta</h1>
        <ProductSearch inputRef={searchRef} onSelect={addProduct} />
        <p className="mt-3 text-xs text-slate-500">
          Atajos: F2 buscar · ↑ ↓ elegir · Enter agregar · Esc limpiar · F9 confirmar venta
        </p>
        {notice && <SaleNotice notice={notice} onDismiss={() => setNotice(null)} />}
      </section>
      <Cart
        lines={cart.lines}
        totalCents={cart.totalCents}
        submitting={submitting}
        onQuantityChange={cart.setQuantity}
        onRemove={cart.remove}
        onClear={cart.clear}
        onConfirm={() => void confirmSale()}
      />
    </div>
  )
}

function SaleNotice({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  if (notice.kind === 'error') {
    return (
      <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        {notice.text}
      </div>
    )
  }

  const productCount = notice.sale.items.length
  const toRestock = notice.sale.items.filter((i) => i.stockAfter <= i.minStock)
  return (
    <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium text-emerald-800">
          Venta registrada: se descontó el stock de {productCount}{' '}
          {productCount === 1 ? 'producto' : 'productos'}.
        </p>
        <button type="button" onClick={onDismiss} aria-label="Cerrar aviso" className="text-emerald-700">
          ✕
        </button>
      </div>
      {toRestock.length > 0 && (
        <div className="mt-2 text-sm text-amber-800">
          <p className="font-medium">Quedaron en el mínimo o por debajo, hay que reponer:</p>
          <ul className="mt-1 list-disc pl-5">
            {toRestock.map((item) => (
              <li key={item.productId}>
                {item.description}: quedan {formatQuantity(item.stockAfter)} (mínimo {item.minStock})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
