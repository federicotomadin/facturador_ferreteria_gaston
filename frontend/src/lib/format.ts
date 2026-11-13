const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

// Amounts come from the API as Decimal strings (e.g. "181.50")
export function formatCurrency(amount: string | number): string {
  return currencyFormatter.format(Number(amount))
}

// Integer cents avoid float drift when adding up prices on the client
export function toCents(amount: string): number {
  return Math.round(Number(amount) * 100)
}

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}
