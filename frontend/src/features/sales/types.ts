export interface ProductSearchResult {
  id: number
  code: string
  description: string
  salePrice: string
  stock: number
  minStock: number
  categoryName: string | null
}

export interface CartLine {
  product: ProductSearchResult
  // 0 while the user is typing a new value in the quantity field
  quantity: number
}

export interface Sale {
  id: number
  total: string
  createdAt: string
  items: {
    productId: number
    code: string
    description: string
    quantity: number
    stockAfter: number
    minStock: number
  }[]
}
