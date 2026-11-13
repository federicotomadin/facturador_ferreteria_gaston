/**
 * Loads the initial stock (Saldo) and cost from the "Stock" sheet of the store's
 * spreadsheet. Products missing from the price list are created with price 0.
 * Every product gets an INITIAL stock movement.
 *
 * Safe to re-run before the first sale: previous INITIAL movements are replaced.
 * Once sales or manual movements exist it refuses to run, because overwriting the
 * stock would undo them (pass --force to do it anyway).
 *
 * Usage: npm run import:stock -- <path-to-xlsx> [--dry-run] [--force]
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import readXlsxFile from 'read-excel-file/node';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { CATEGORIES } from './category-rules.js';
import { countByType, toReviewCsv } from './review-csv.js';
import { parseStockSheet, resolveDuplicateCodes, type Cell } from './stock-sheet.js';

const SHEET_NAME = 'Stock';
const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const xlsxPath = args.find((arg) => !arg.startsWith('--'));
if (!xlsxPath) {
  console.error('Usage: npm run import:stock -- <path-to-xlsx> [--dry-run] [--force]');
  process.exit(1);
}

const sheets = await readXlsxFile(xlsxPath);
const sheet = sheets.find((s) => s.sheet === SHEET_NAME);
if (!sheet) {
  console.error(`Sheet "${SHEET_NAME}" not found. Sheets: ${sheets.map((s) => s.sheet).join(', ')}`);
  process.exit(1);
}
const parsed = parseStockSheet(sheet.data as Cell[][]);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

try {
  const existing = await prisma.product.findMany({ select: { code: true, description: true } });
  const descriptionByCode = new Map(existing.map((p) => [p.code, p.description]));
  const { entries, issues: duplicateIssues } = resolveDuplicateCodes(parsed.entries, descriptionByCode);
  const issues = [...parsed.issues, ...duplicateIssues].sort((a, b) => a.sourceRow - b.sourceRow);

  const reviewPath = path.join(path.dirname(xlsxPath), 'import-stock-review.csv');
  writeFileSync(reviewPath, toReviewCsv(issues));

  const newProducts = entries.filter((e) => !descriptionByCode.has(e.code));
  console.log(`Products with stock: ${entries.length} (${newProducts.length} new, created with price 0)`);
  console.log(`Products with decimal stock: ${entries.filter((e) => !e.stock.endsWith('.000')).length}`);
  console.log('Issues:');
  console.table(countByType(issues));
  console.log(`Review file: ${reviewPath}`);

  const laterMovements = await prisma.stockMovement.count({ where: { type: { not: 'INITIAL' } } });
  if (laterMovements > 0 && !force) {
    console.error(
      `\n${laterMovements} sale/manual stock movements already exist; loading the sheet would undo them. ` +
        'Re-run with --force to overwrite the stock anyway.',
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log('\nDry run: nothing was written to the database.');
    process.exit(0);
  }

  await prisma.category.createMany({ data: [...CATEGORIES], skipDuplicates: true });
  const supplierNames = [...new Set(newProducts.flatMap((p) => (p.supplier ? [p.supplier] : [])))];
  await prisma.supplier.createMany({ data: supplierNames.map((name) => ({ name })), skipDuplicates: true });
  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
  ]);
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const supplierIdByName = new Map(suppliers.map((s) => [s.name, s.id]));
  const note = `Stock inicial: ${path.basename(xlsxPath)}`;

  const loaded = await prisma.$transaction(
    async (tx) => {
      await tx.stockMovement.deleteMany({ where: { type: 'INITIAL' } });
      let count = 0;
      for (let start = 0; start < entries.length; start += BATCH_SIZE) {
        const values = entries.slice(start, start + BATCH_SIZE).map(
          (e) => Prisma.sql`(
            ${e.code}, ${e.description}, ${e.supplierCode},
            ${e.supplier ? supplierIdByName.get(e.supplier) : null}::int,
            ${categoryIdBySlug.get(e.category)}::int,
            ${e.stock}::numeric, ${e.costPrice}::numeric, now()
          )`,
        );
        // Existing products only get stock and cost: description and price belong to the price list
        const rows = await tx.$queryRaw<{ id: number; stock: Prisma.Decimal }[]>`
          INSERT INTO "Product" ("code", "description", "supplierCode", "supplierId", "categoryId", "stock", "costPrice", "updatedAt")
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("code") DO UPDATE SET
            "stock"     = EXCLUDED."stock",
            "costPrice" = COALESCE(EXCLUDED."costPrice", "Product"."costPrice"),
            "updatedAt" = now()
          RETURNING "id", "stock"
        `;
        await tx.stockMovement.createMany({
          data: rows.map((r) => ({ productId: r.id, type: 'INITIAL' as const, quantity: r.stock, stockAfter: r.stock, note })),
        });
        count += rows.length;
      }
      return count;
    },
    { timeout: 120_000 },
  );
  console.log(`\nLoaded stock for ${loaded} products.`);
} finally {
  await prisma.$disconnect();
}
