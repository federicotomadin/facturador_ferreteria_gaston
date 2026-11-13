import { NavLink, Outlet } from 'react-router-dom'
import { ServerStatus } from './ServerStatus'

const NAV_ITEMS = [
  { to: '/', label: 'Venta' },
  { to: '/products', label: 'Productos' },
  { to: '/stock', label: 'Stock' },
  { to: '/reports', label: 'Reportes' },
]

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <div className="print:hidden">
        <ServerStatus />
      </div>
      <header className="bg-slate-900 text-white print:hidden">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Ferretería Gastón</span>
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? 'text-white' : 'text-slate-400 hover:text-white'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:p-0">
        <Outlet />
      </main>
    </div>
  )
}
