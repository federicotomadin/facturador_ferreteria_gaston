import { apiFetch } from '../../lib/api'
import type { ProductSearchResult } from '../sales/types'

export interface Category {
  id: number
  name: string
}

export interface NewProduct {
  code: string
  description: string
  stock: number
  costPrice?: number
  salePrice?: number
  minStock?: number
  categoryId?: number
}

export function listCategories() {
  return apiFetch<Category[]>('/categories')
}

export function createProduct(product: NewProduct) {
  return apiFetch<ProductSearchResult>('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  })
}
