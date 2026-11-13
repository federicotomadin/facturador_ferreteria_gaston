import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProductsPage } from './features/products/ProductsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { SalesPage } from './features/sales/SalesPage'
import { StockPage } from './features/stock/StockPage'

// HashRouter: GitHub Pages can't rewrite deep links to index.html
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SalesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
