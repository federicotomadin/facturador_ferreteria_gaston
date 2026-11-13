import { categorize, type CategorySlug } from './category-rules.js';
import { normalizeCode, normalizeSupplier } from './price-list.js';
import type { ReviewIssue } from './review-csv.js';

export type Cell = string | number | boolean | Date | null;

// "Stock" sheet columns: Código, Producto, Cód. Prov, Prov, Cantidad, Ventas, Saldo, (blank), Costo
const COLUMN = {
  code: 0,
  description: 1,
  supplierCode: 2,
  supplier: 3,
  quantity: 4,
  sales: 5,
  balance: 6,
  cost: 8,
} as const;
const HEADER_FIRST_CELL = 'Código';

export interface StockSheetEntry {
  code: string;
  description: string;
  supplierCode: string | null;
  supplier: string | null;
  // Fixed 3-decimal string, safe to pass to NUMERIC(12, 3)
  stock: string;
  // Fixed 2-decimal string; null when the sheet has no usable cost
  costPrice: string | null;
  category: CategorySlug;
  sourceRow: number;
}

export type StockIssueType =
  | 'missing-code'
  | 'missing-stock'
  | 'invalid-stock'
  | 'negative-stock'
  | 'stock-mismatch'
  | 'invalid-cost'
  | 'duplicate-code';

export interface StockIssue extends ReviewIssue {
  type: StockIssueType;
}

export function parseNumber(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== 'string') return null;
  const value = cell.trim();
  if (!/^-?\d+([.,]\d+)?$/.test(value)) return null;
  return Number(value.replace(',', '.'));
}

const toFixedStock = (value: number) => (Math.round(value * 1000) / 1000).toFixed(3);

const text = (cell: Cell) => (cell === null || cell instanceof Date ? '' : String(cell).trim());

export function parseStockSheet(rows: Cell[][]): { entries: StockSheetEntry[]; issues: StockIssue[] } {
  const entries: StockSheetEntry[] = [];
  const issues: StockIssue[] = [];
  const headerIndex = rows.findIndex((row) => text(row[COLUMN.code] ?? null) === HEADER_FIRST_CELL);
  if (headerIndex === -1) throw new Error(`Header row starting with "${HEADER_FIRST_CELL}" not found`);

  rows.slice(headerIndex + 1).forEach((row, index) => {
    // Spreadsheet row numbers are 1-based
    const sourceRow = headerIndex + index + 2;
    const cell = (column: number): Cell => row[column] ?? null;
    const code = normalizeCode(text(cell(COLUMN.code)));
    const description = text(cell(COLUMN.description)).replace(/\s+/g, ' ');
    const report = (type: StockIssueType, detail?: string) =>
      issues.push({ type, sourceRow, code, description, detail });

    if (!code) {
      if (description) report('missing-code');
      return;
    }

    const balance = parseNumber(cell(COLUMN.balance));
    let stock = 0;
    if (cell(COLUMN.balance) === null) {
      report('missing-stock', `Loaded as 0 (Cantidad: ${text(cell(COLUMN.quantity)) || 'empty'})`);
    } else if (balance === null) {
      report('invalid-stock', `Loaded as 0 (Saldo: ${text(cell(COLUMN.balance))})`);
    } else if (balance < 0) {
      report('negative-stock', `Loaded as 0 (Saldo: ${balance})`);
    } else {
      stock = balance;
      const quantity = parseNumber(cell(COLUMN.quantity));
      const sales = parseNumber(cell(COLUMN.sales)) ?? 0;
      if (quantity !== null && Math.abs(quantity - sales - balance) > 0.0005) {
        report('stock-mismatch', `Cantidad ${quantity} - Ventas ${sales} != Saldo ${balance}; kept Saldo`);
      }
    }

    const rawCost = cell(COLUMN.cost);
    const cost = parseNumber(rawCost);
    if (rawCost !== null && (cost === null || cost < 0)) {
      report('invalid-cost', `Ignored (Costo: ${rawCost instanceof Date ? 'date/time' : text(rawCost)})`);
    }

    entries.push({
      code,
      description,
      supplierCode: text(cell(COLUMN.supplierCode)) || null,
      supplier: normalizeSupplier(text(cell(COLUMN.supplier))).name,
      stock: toFixedStock(stock),
      costPrice: cost !== null && cost > 0 ? (Math.round(cost * 100) / 100).toFixed(2) : null,
      category: categorize(description),
      sourceRow,
    });
  });

  return { entries, issues };
}

const comparable = (description: string) =>
  description.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Some codes appear on two different products. The stock goes to the row describing
 * the product already in the database (or the first row for new codes); the rest are
 * reported so the owner can assign them a new code.
 */
export function resolveDuplicateCodes(
  entries: StockSheetEntry[],
  descriptionByCode: Map<string, string>,
): { entries: StockSheetEntry[]; issues: StockIssue[] } {
  const byCode = Map.groupBy(entries, (e) => e.code);
  const kept: StockSheetEntry[] = [];
  const issues: StockIssue[] = [];

  for (const [code, group] of byCode) {
    const existing = descriptionByCode.get(code);
    const winner =
      (existing !== undefined && group.find((e) => comparable(e.description) === comparable(existing))) || group[0];
    kept.push(winner);
    for (const loser of group.filter((e) => e !== winner)) {
      issues.push({
        type: 'duplicate-code',
        sourceRow: loser.sourceRow,
        code,
        description: loser.description,
        detail: `Not imported: code already used by "${winner.description}" (row ${winner.sourceRow}). Needs a new code`,
      });
    }
  }

  return { entries: kept, issues };
}
