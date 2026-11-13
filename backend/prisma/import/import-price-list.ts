/**
 * Imports the sale price list CSV into the database. Safe to re-run:
 * products are upserted by code, and stock, cost, min stock and manually
 * reassigned categories are never overwritten.
 *
 * Usage: npm run import:prices -- <path-to-csv> [--dry-run]
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { parse } from 'csv-parse/sync';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { CATEGORIES } from './category-rules.js';
import { parsePriceList, type ImportIssue } from './price-list.js';
import { countByType, toReviewCsv } from './review-csv.js';

const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvPath = args.find((arg) => !arg.startsWith('--'));
if (!csvPath) {
  console.error('Usage: npm run import:prices -- <path-to-csv> [--dry-run]');
  process.exit(1);
}

const rows: string[][] = parse(readFileSync(csvPath), {
  bom: true,
  relax_column_count: true,
  skip_empty_lines: true,
});
const { products, issues } = parsePriceList(rows);

const reviewPath = path.join(path.dirname(csvPath), 'import-review.csv');
writeFileSync(reviewPath, toReviewCsv(issues));
printSummary(products.length, issues, reviewPath);

if (dryRun) {
  console.log('\nDry run: nothing was written to the database.');
  process.exit(0);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

try {
  await prisma.category.createMany({ data: [...CATEGORIES], skipDuplicates: true });
  const supplierNames = [...new Set(products.flatMap((p) => (p.supplier ? [p.supplier] : [])))];
  await prisma.supplier.createMany({
    data: supplierNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
  ]);
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const supplierIdByName = new Map(suppliers.map((s) => [s.name, s.id]));

  let affected = 0;
  for (let start = 0; start < products.length; start += BATCH_SIZE) {
    const values = products.slice(start, start + BATCH_SIZE).map(
      (p) => Prisma.sql`(
        ${p.code}, ${p.description}, ${p.supplierCode},
        ${p.supplier ? supplierIdByName.get(p.supplier) : null}::int,
        ${categoryIdBySlug.get(p.category)}::int,
        ${p.salePrice}::numeric, now()
      )`,
    );
    // Category only fills empty values so manual reassignments survive a re-import
    affected += await prisma.$executeRaw`
      INSERT INTO "Product" ("code", "description", "supplierCode", "supplierId", "categoryId", "salePrice", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("code") DO UPDATE SET
        "description"  = EXCLUDED."description",
        "supplierCode" = EXCLUDED."supplierCode",
        "supplierId"   = EXCLUDED."supplierId",
        "categoryId"   = COALESCE("Product"."categoryId", EXCLUDED."categoryId"),
        "salePrice"    = EXCLUDED."salePrice",
        "updatedAt"    = now()
    `;
  }
  console.log(`\nUpserted ${affected} products.`);
} finally {
  await prisma.$disconnect();
}

function printSummary(productCount: number, list: ImportIssue[], reviewFile: string) {
  const byCategory = Object.groupBy(products, (p) => p.category);
  console.log(`Products parsed: ${productCount}`);
  console.table(
    Object.fromEntries(Object.entries(byCategory).map(([slug, items]) => [slug, items?.length ?? 0])),
  );
  console.log('Issues:');
  console.table(countByType(list));
  console.log(`Review file: ${reviewFile}`);
}
