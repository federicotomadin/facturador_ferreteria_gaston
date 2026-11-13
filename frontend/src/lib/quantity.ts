// Quantities have up to 3 decimals (products sold by length or weight, e.g. 1,5 m)
const SCALE = 1000

const quantityFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 })

export function formatQuantity(quantity: number): string {
  return quantityFormatter.format(quantity)
}

// Integer thousandths avoid float drift when adding or subtracting quantities (0.1 + 0.2)
export function roundQuantity(quantity: number): number {
  return Math.round(quantity * SCALE) / SCALE
}

export function hasValidPrecision(quantity: number): boolean {
  return Math.abs(quantity * SCALE - Math.round(quantity * SCALE)) < 1e-6
}

// Accepts "1,5" (es-AR) as well as "1.5"; returns null while the text isn't a number yet
export function parseQuantity(text: string): number | null {
  const value = text.trim().replace(',', '.')
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(value)) return null
  return Number(value)
}
