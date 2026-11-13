import { type KeyboardEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { formatCurrency, toCents } from '../../lib/format'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { searchProducts } from './api'
import { StockBadge } from './StockBadge'
import type { ProductSearchResult } from './types'

interface ProductSearchProps {
  inputRef: RefObject<HTMLInputElement | null>
  onSelect: (product: ProductSearchResult) => void
  // Offered when nothing matches (e.g. a scanned code that isn't in the catalog yet)
  onCreateRequest: (text: string) => void
}

const MIN_QUERY_LENGTH = 2

// The scanner may send the Code 39 delimiters ("*00001*")
const normalizeCode = (text: string) => text.replace(/^\*+|\*+$/g, '').toLowerCase()

export function ProductSearch({ inputRef, onSelect, onCreateRequest }: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [resultsFor, setResultsFor] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState(-1)
  const searchAbort = useRef<AbortController | null>(null)
  const trimmedQuery = query.trim()
  const debouncedQuery = useDebouncedValue(trimmedQuery, 250)
  // Covers both the debounce wait and the request in flight
  const loading = trimmedQuery.length >= MIN_QUERY_LENGTH && resultsFor !== trimmedQuery

  const runSearch = useCallback(async (text: string): Promise<ProductSearchResult[] | null> => {
    searchAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    try {
      const found = await searchProducts(text, controller.signal)
      setResults(found)
      setHighlighted(-1)
      setMessage(null)
      setNotFound(found.length ? null : text)
      setResultsFor(text)
      return found
    } catch {
      if (controller.signal.aborted) return null
      setResults([])
      setNotFound(null)
      setMessage('No se pudo buscar. Revisá la conexión.')
      setResultsFor(text)
      return null
    }
  }, [])

  useEffect(() => {
    // Skip when the debounced value is stale (e.g. right after a reset)
    if (debouncedQuery !== trimmedQuery) return
    // runSearch only sets state after the request resolves
    // oxlint-disable-next-line react/set-state-in-effect
    if (debouncedQuery.length >= MIN_QUERY_LENGTH) void runSearch(debouncedQuery)
  }, [debouncedQuery, trimmedQuery, runSearch])

  const clear = () => {
    searchAbort.current?.abort()
    setQuery('')
    setResults([])
    setResultsFor('')
    setMessage(null)
    setNotFound(null)
    setHighlighted(-1)
  }

  const select = (product: ProductSearchResult) => {
    onSelect(product)
    clear()
    inputRef.current?.focus()
  }

  const requestCreate = (text: string) => {
    clear()
    onCreateRequest(text)
  }

  // Scanner: frees the input right away so the next code can be scanned while this one
  // is looked up, and resolves scans in order. Falls back to showing the list if the
  // text isn't an exact code (e.g. a product name typed by hand).
  const lookupQueue = useRef<Promise<void>>(Promise.resolve())
  const lookup = (text: string) => {
    lookupQueue.current = lookupQueue.current.then(async () => {
      const found = await searchProducts(text).catch(() => null)
      if (!found) return setMessage('No se pudo buscar. Revisá la conexión.')
      const exactCode = found.find((p) => p.code.toLowerCase() === normalizeCode(text))
      if (exactCode || found.length === 1) {
        onSelect(exactCode ?? found[0])
        return
      }
      setQuery((current) => current || text)
      setResults(found)
      setHighlighted(-1)
      setMessage(null)
      setNotFound(found.length ? null : text)
      setResultsFor(text)
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!results.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlighted((i) => (i + step + results.length) % results.length)
      return
    }
    if (event.key === 'Escape') return clear()
    if (event.key !== 'Enter') return

    event.preventDefault()
    if (!trimmedQuery) return
    if (highlighted >= 0 && results[highlighted]) return select(results[highlighted])

    if (resultsFor === trimmedQuery) {
      if (notFound === trimmedQuery) return requestCreate(trimmedQuery)
      const exactCode = results.find((p) => p.code.toLowerCase() === normalizeCode(trimmedQuery))
      if (exactCode || results.length === 1) select(exactCode ?? results[0])
      return
    }
    const text = trimmedQuery
    clear()
    lookup(text)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          if (event.target.value.trim().length < MIN_QUERY_LENGTH) {
            searchAbort.current?.abort()
            setResults([])
            setResultsFor('')
            setMessage(null)
            setNotFound(null)
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="Escaneá el código o escribí el nombre del producto"
        aria-label="Buscar producto"
        autoComplete="off"
        className="w-full rounded-xl border-2 border-slate-300 bg-white px-5 py-5 text-2xl shadow-sm outline-none focus:border-sky-500"
      />
      {loading && (
        <span className="absolute top-6 right-5 text-sm text-slate-400">Buscando...</span>
      )}
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      {notFound && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-amber-900">No se encontró ningún producto para «{notFound}».</p>
          <button
            type="button"
            onClick={() => requestCreate(notFound)}
            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700"
          >
            Crear producto (Enter)
          </button>
        </div>
      )}

      {results.length > 0 && (
        <ul className="mt-2 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {results.map((product, index) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => select(product)}
                className={`flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-sky-50 ${
                  index === highlighted ? 'bg-sky-100' : ''
                }`}
              >
                <span className="w-20 shrink-0 font-mono text-sm text-slate-500">{product.code}</span>
                <span className="flex-1">
                  {product.description}
                  {product.categoryName && (
                    <span className="block text-xs text-slate-500">{product.categoryName}</span>
                  )}
                </span>
                <StockBadge product={product} />
                <span className="w-28 text-right font-medium">
                  {toCents(product.salePrice) > 0 ? (
                    formatCurrency(product.salePrice)
                  ) : (
                    <span className="text-sm text-slate-400">Sin precio</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
