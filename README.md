# Ferretería Gastón — Inventory & Sales

Stock control, point-of-sale and receipts for a hardware store. Scope and roadmap: [`plan.md`](plan.md).

| Folder      | Stack                          | Deploy                 |
| ----------- | ------------------------------ | ---------------------- |
| `frontend/` | React + Vite + Tailwind CSS    | GitHub Pages           |
| `backend/`  | NestJS + Prisma 7 + PostgreSQL | Render (`render.yaml`) |

Database: Supabase in production, Docker locally.

## Local development

Requirements: Node 24, Docker.

```bash
# 1. Database (Postgres on localhost:5433)
docker compose up -d

# 2. Backend (http://localhost:3000/api)
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run start:dev

# 3. Frontend (http://localhost:5173)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Importing the product list

The price list CSV is business data and is never committed (`*.csv` is gitignored).

```bash
cd backend
npm run import:prices -- ../LISTA_ROOFTECH_Precios_Venta.csv --dry-run   # preview only
npm run import:prices -- ../LISTA_ROOFTECH_Precios_Venta.csv
```

The import is safe to re-run: products are upserted by code, and stock, cost, minimum stock and
manually changed categories are kept. Every problem found (zero prices, duplicated codes,
uncategorized products...) is written to `import-review.csv` next to the input file.

## Tests

```bash
cd backend
npm test           # unit tests
npm run test:e2e   # needs the local database
npm run lint
```

## Deploy

1. **Supabase**: create a project and copy both pooler connection strings (see `backend/.env.example`).
2. **Render**: New > Blueprint, pick this repo; it reads `render.yaml`. Fill in `DATABASE_URL`,
   `DIRECT_URL` and `FRONTEND_URL`. Migrations run on every start.
3. **GitHub Pages**: Settings > Pages > Source: GitHub Actions. Add the repository variable
   `VITE_API_URL` (e.g. `https://ferreteria-api.onrender.com/api`). Every push to `main` that
   touches `frontend/` redeploys.
