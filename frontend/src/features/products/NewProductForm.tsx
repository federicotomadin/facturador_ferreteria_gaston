import { type FormEvent, useEffect, useId, useState } from 'react'
import { ApiError } from '../../lib/api'
import { parseQuantity } from '../../lib/quantity'
import type { ProductSearchResult } from '../sales/types'
import { type Category, createProduct, listCategories, type NewProduct } from './api'

interface NewProductFormProps {
  // What was scanned or typed in the search box
  initialCode: string
  initialDescription: string
  onCreated: (product: ProductSearchResult) => void
  onCancel: () => void
}

const DEFAULT_MIN_STOCK = '5'

type Field = 'code' | 'description' | 'stock' | 'costPrice' | 'salePrice' | 'minStock'

// Empty is allowed for optional fields; "1,5" and "1.5" are both accepted
function parseDecimal(text: string, maxDecimals: number): number | null | undefined {
  if (!text.trim()) return undefined
  const value = parseQuantity(text)
  if (value === null) return null
  const decimals = text.trim().split(/[.,]/)[1]?.length ?? 0
  return decimals > maxDecimals ? null : value
}

export function NewProductForm({ initialCode, initialDescription, onCreated, onCancel }: NewProductFormProps) {
  const titleId = useId()
  const [values, setValues] = useState({
    code: initialCode,
    description: initialDescription,
    stock: '',
    costPrice: '',
    salePrice: '',
    minStock: DEFAULT_MIN_STOCK,
    categoryId: '',
  })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    // Optional field: without categories the product is created without one
    listCategories().then(setCategories, () => setCategories([]))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, submitting])

  const set = (field: keyof typeof values) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors(({ [field as Field]: _fixed, ...rest }) => rest)
  }

  const validate = (): NewProduct | null => {
    const found: Partial<Record<Field, string>> = {}
    const code = values.code.trim().replace(/^\*+|\*+$/g, '')
    const description = values.description.trim()
    const stock = parseDecimal(values.stock, 3)
    const costPrice = parseDecimal(values.costPrice, 2)
    const salePrice = parseDecimal(values.salePrice, 2)
    const minStock = parseDecimal(values.minStock, 0)

    if (!code) found.code = 'Ingresá el código.'
    else if (code.length > 30) found.code = 'Máximo 30 caracteres.'
    if (description.length < 2) found.description = 'Ingresá la descripción.'
    else if (description.length > 200) found.description = 'Máximo 200 caracteres.'
    if (stock === undefined) found.stock = 'Ingresá la cantidad (puede ser 0).'
    else if (stock === null) found.stock = 'Cantidad inválida (hasta 3 decimales).'
    if (costPrice === null) found.costPrice = 'Costo inválido (hasta 2 decimales).'
    if (salePrice === null) found.salePrice = 'Precio inválido (hasta 2 decimales).'
    if (minStock === null) found.minStock = 'Ingresá un número entero.'

    setErrors(found)
    if (Object.keys(found).length > 0) return null
    return {
      code,
      description,
      stock: stock as number,
      costPrice: costPrice ?? undefined,
      salePrice: salePrice ?? undefined,
      minStock: minStock ?? undefined,
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const product = validate()
    if (!product || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      onCreated(await createProduct(product))
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ code: `Ya existe un producto con el código ${product.code}.` })
      } else if (error instanceof ApiError && error.status === 400) {
        setSubmitError('Revisá los datos ingresados.')
      } else {
        setSubmitError('No se pudo crear el producto. Revisá la conexión e intentá de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[10vh]">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
        className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          Producto nuevo
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          El código no está cargado. Completá los datos para darlo de alta.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Código"
            value={values.code}
            onChange={set('code')}
            error={errors.code}
            autoFocus={!initialCode}
            required
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Categoría</span>
            <select
              value={values.categoryId}
              onChange={(event) => set('categoryId')(event.target.value)}
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-base"
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <TextField
              label="Descripción"
              value={values.description}
              onChange={set('description')}
              error={errors.description}
              autoFocus={Boolean(initialCode) && !initialDescription}
              required
            />
          </div>
          <TextField
            label="Cantidad en stock"
            value={values.stock}
            onChange={set('stock')}
            error={errors.stock}
            hint="Puede tener decimales (metros, kg)."
            autoFocus={Boolean(initialCode && initialDescription)}
            inputMode="decimal"
            required
          />
          <TextField
            label="Stock mínimo"
            value={values.minStock}
            onChange={set('minStock')}
            error={errors.minStock}
            inputMode="numeric"
          />
          <TextField
            label="Costo"
            value={values.costPrice}
            onChange={set('costPrice')}
            error={errors.costPrice}
            hint="Opcional."
            inputMode="decimal"
          />
          <TextField
            label="Precio de venta"
            value={values.salePrice}
            onChange={set('salePrice')}
            error={errors.salePrice}
            hint="Opcional. Sin precio se puede vender igual."
            inputMode="decimal"
          />
        </div>

        {submitError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {submitError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg px-4 py-3 text-slate-600 hover:bg-slate-100"
          >
            Cancelar (Esc)
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {submitting ? 'Guardando...' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  autoFocus?: boolean
  required?: boolean
  inputMode?: 'decimal' | 'numeric'
}

function TextField({ label, value, onChange, error, hint, autoFocus, required, inputMode }: TextFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? messageId : undefined}
        className={`h-11 rounded-lg border px-3 text-base ${
          error ? 'border-red-500 bg-red-50' : 'border-slate-300'
        }`}
      />
      {message && (
        <span id={messageId} className={error ? 'text-red-700' : 'text-slate-500'}>
          {message}
        </span>
      )}
    </div>
  )
}
