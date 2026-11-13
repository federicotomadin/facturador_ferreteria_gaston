import { normalizeCode } from '../../src/products/product-code.js';
import { categorize, type CategorySlug } from './category-rules.js';

export { normalizeCode };

// Column order of LISTA_ROOFTECH_Precios_Venta.csv: Código, Producto, Cód. Prov, Prov, Precio
const COLUMN = { code: 0, description: 1, supplierCode: 2, supplier: 3, price: 4 } as const;
const FIRST_UNNAMED_COLUMN = 5;

export interface PriceListProduct {
  code: string;
  description: string;
  supplierCode: string | null;
  supplier: string | null;
  // Fixed 2-decimal string, safe to pass to Prisma.Decimal / NUMERIC
  salePrice: string;
  category: CategorySlug;
  sourceRow: number;
}

export type IssueType =
  | 'missing-code'
  | 'duplicate-code'
  | 'missing-price'
  | 'invalid-price'
  | 'zero-price'
  | 'unnamed-columns'
  | 'multiple-suppliers'
  | 'uncategorized';

export interface ImportIssue {
  type: IssueType;
  sourceRow: number;
  code: string;
  description: string;
  detail?: string;
}

export interface ParsedPriceList {
  products: PriceListProduct[];
  issues: ImportIssue[];
}

// Same supplier written in different ways in the spreadsheet
const SUPPLIER_ALIASES: Record<string, string> = {
  louzam: 'Louzan',
};

export function normalizeSupplier(raw: string): { name: string | null; others: string[] } {
  const [first, ...others] = raw
    .split('/')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  if (!first) return { name: null, others: [] };
  const name = SUPPLIER_ALIASES[first.toLowerCase()] ?? first.split(' ').map(capitalize).join(' ');
  return { name, others };
}

// "ADRI" and "adri" become "Adri"; mixed-case words like "AyCA" are kept as written
function capitalize(word: string): string {
  const isSingleCase = word === word.toUpperCase() || word === word.toLowerCase();
  return isSingleCase ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
}

export function parsePrice(raw: string): string | null {
  const value = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  return (Math.round(Number(value) * 100) / 100).toFixed(2);
}

export function parsePriceList(rows: string[][]): ParsedPriceList {
  const products: PriceListProduct[] = [];
  const issues: ImportIssue[] = [];
  const seenCodes = new Set<string>();

  // rows[0] is the header; spreadsheet row numbers are 1-based
  rows.slice(1).forEach((row, index) => {
    const sourceRow = index + 2;
    const cell = (column: number) => (row[column] ?? '').trim();
    const code = normalizeCode(cell(COLUMN.code));
    const description = cell(COLUMN.description).replace(/\s+/g, ' ');
    const report = (type: IssueType, detail?: string) =>
      issues.push({ type, sourceRow, code, description, detail });

    if (!code) {
      if (description) report('missing-code');
      return;
    }
    if (seenCodes.has(code)) {
      report('duplicate-code', 'Skipped, the first row with this code was kept');
      return;
    }
    seenCodes.add(code);

    const rawPrice = cell(COLUMN.price);
    let salePrice = parsePrice(rawPrice);
    if (!rawPrice) report('missing-price');
    else if (salePrice === null) report('invalid-price', rawPrice);
    else if (Number(salePrice) === 0) report('zero-price');
    salePrice ??= '0.00';

    const unnamed = row.slice(FIRST_UNNAMED_COLUMN).map((v) => v.trim()).filter(Boolean);
    if (unnamed.length) report('unnamed-columns', unnamed.join(' | '));

    const supplier = normalizeSupplier(cell(COLUMN.supplier));
    if (supplier.others.length) {
      report('multiple-suppliers', `Kept ${supplier.name}, ignored ${supplier.others.join(', ')}`);
    }

    const category = categorize(description);
    if (category === 'uncategorized') report('uncategorized');

    products.push({
      code,
      description,
      supplierCode: cell(COLUMN.supplierCode) || null,
      supplier: supplier.name,
      salePrice,
      category,
      sourceRow,
    });
  });

  return { products, issues };
}
