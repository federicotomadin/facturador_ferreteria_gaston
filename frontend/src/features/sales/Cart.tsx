import { useState } from 'react'
import { formatCents, formatCurrency, toCents } from '../../lib/format'
import { formatQuantity, parseQuantity, roundQuantity } from '../../lib/quantity'
import { checkStock, hasBlockingLine, isBlocking } from './stock-check'
import type { CartLine } from './types'
import { lineCents } from './useCart'

interface CartProps {
  lines: CartLine[]
  totalCents: number
  submitting: boolean
  onQuantityChange: (productId: number, quantity: number) => void
  onRemove: (productId: number) => void
  onClear: () => void
  onConfirm: () => void
}

const MESSAGE_STYLES = {
  error: 'text-red-700',
  invalid: 'text-red-700',
  warning: 'text-amber-700',
} as const

interface QuantityInputProps {
  quantity: number
  onChange: (quantity: number) => void
  label: string
  invalid: boolean
}

// Text input instead of type="number": it must accept the es-AR decimal comma ("1,5")
function QuantityInput({ quantity, onChange, label, invalid }: QuantityInputProps) {
  const [text, setText] = useState('')
  // Keep what the user is typing ("1," or "1,50") unless the quantity changed elsewhere (+/−, rescan)
  const shown = (parseQuantity(text) ?? 0) === quantity ? text : String(quantity).replace('.', ',')

  return (
    <input
      type="text"
      inputMode="decimal"
      value={shown}
      onChange={(event) => {
        setText(event.target.value)
        onChange(parseQuantity(event.target.value) ?? 0)
      }}
      onFocus={(event) => event.target.select()}
      aria-label={label}
      aria-invalid={invalid}
      className={`h-9 w-20 rounded border text-center text-lg ${
        invalid ? 'border-red-500 bg-red-50' : 'border-slate-300'
      }`}
    />
  )
}

export function Cart({
  lines,
  totalCents,
  submitting,
  onQuantityChange,
  onRemove,
  onClear,
  onConfirm,
}: CartProps) {
  const blocked = hasBlockingLine(lines)

  return (
    <aside className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-semibold">Cesta</h2>
        {lines.length > 0 && (
          <button
            type="button"
            onClick={() => window.confirm('¿Vaciar la cesta?') && onClear()}
            disabled={submitting}
            className="text-sm text-slate-500 hover:text-red-700"
          >
            Vaciar
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="px-4 py-10 text-center text-slate-500">Todavía no agregaste productos.</p>
      ) : (
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {lines.map(({ product, quantity }) => {
            const check = checkStock(product, quantity)
            const hasPrice = toCents(product.salePrice) > 0
            return (
              <li key={product.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{product.description}</p>
                    <p className="text-xs text-slate-500">
                      {product.code} · Stock {formatQuantity(product.stock)}
                      {hasPrice && ` · ${formatCurrency(product.salePrice)} c/u`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(product.id)}
                    aria-label={`Quitar ${product.description}`}
                    className="text-slate-400 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onQuantityChange(product.id, roundQuantity(quantity - 1))}
                      disabled={quantity < 2}
                      aria-label="Restar uno"
                      className="h-9 w-9 rounded border border-slate-300 disabled:opacity-40"
                    >
                      −
                    </button>
                    <QuantityInput
                      quantity={quantity}
                      onChange={(value) => onQuantityChange(product.id, value)}
                      label={`Cantidad de ${product.description}`}
                      invalid={isBlocking(check)}
                    />
                    <button
                      type="button"
                      onClick={() => onQuantityChange(product.id, roundQuantity(quantity + 1))}
                      disabled={quantity + 1 > product.stock}
                      aria-label="Sumar uno"
                      className="h-9 w-9 rounded border border-slate-300 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-medium">
                    {hasPrice ? formatCents(lineCents({ product, quantity })) : '—'}
                  </span>
                </div>
                {check.level !== 'ok' && (
                  <p role="alert" className={`mt-2 text-sm ${MESSAGE_STYLES[check.level]}`}>
                    {check.message}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="border-t border-slate-200 px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-600">Total de referencia</span>
          <span className="text-2xl font-bold">{formatCents(totalCents)}</span>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={lines.length === 0 || blocked || submitting}
          className="mt-4 w-full rounded-lg bg-emerald-600 py-4 text-lg font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Descontando stock...' : 'Confirmar venta (F9)'}
        </button>
        {blocked && (
          <p className="mt-2 text-center text-sm text-red-700">
            Corregí las cantidades marcadas en rojo para continuar.
          </p>
        )}
      </div>
    </aside>
  )
}
