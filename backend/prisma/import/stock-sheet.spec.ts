import { parseNumber, parseStockSheet, resolveDuplicateCodes, type Cell } from './stock-sheet.js';

const HEADER: Cell[] = ['Código', 'Producto', 'Cód. Prov', 'Prov', 'Cantidad', 'Ventas', 'Saldo', null, 'Costo'];

const row = (
  code: Cell,
  description: string,
  { quantity = null, sales = null, balance = null, cost = null, supplier = 'Adri' }: Partial<Record<string, Cell>> = {},
): Cell[] => [code, description, null, supplier, quantity, sales, balance, null, cost];

const parse = (...rows: Cell[][]) => parseStockSheet([[null], HEADER, ...rows]);

describe('parseNumber', () => {
  it.each([
    [7, 7],
    [6.8, 6.8],
    ['12,5', 12.5],
    [' 3 ', 3],
    ['-2', -2],
    ['999,.99H', null],
    [',', null],
    [null, null],
    [new Date(0), null],
  ])('parses %j as %j', (cell, expected) => {
    expect(parseNumber(cell as Cell)).toBe(expected);
  });
});

describe('parseStockSheet', () => {
  it('loads Saldo as the stock and Costo as the cost, with Code 39 asterisks removed', () => {
    const { entries, issues } = parse(row('*00006', 'ABRAZADERA 12-22', { quantity: 20, sales: 13, balance: 7, cost: 60 }));

    expect(entries).toEqual([
      expect.objectContaining({ code: '00006', stock: '7.000', costPrice: '60.00', supplier: 'Adri', sourceRow: 3 }),
    ]);
    expect(issues).toEqual([]);
  });

  it('keeps decimal stock of products sold by length or weight, rounded to 3 decimals', () => {
    const { entries } = parse(
      row('*01026', 'Manguera 9x12 Cristal', { quantity: 100, sales: 7.5, balance: 92.5 }),
      row('*21194', 'PASTILLA x 1 kg', { quantity: 11, sales: 5.200000000000001, balance: 5.799999999999999 }),
    );
    expect(entries.map((e) => e.stock)).toEqual(['92.500', '5.800']);
  });

  it('loads negative, empty and invalid Saldo as 0 and reports them', () => {
    const { entries, issues } = parse(
      row('*10593', 'NEGATIVO', { quantity: 0, sales: 12, balance: -12 }),
      row('*20843', 'SIN SALDO', { quantity: 6 }),
      row('*01222', 'Pila Eveready AAA', { quantity: '999,.99H', balance: '#VALUE!' }),
    );

    expect(entries.map((e) => e.stock)).toEqual(['0.000', '0.000', '0.000']);
    expect(issues.map((i) => i.type)).toEqual(['negative-stock', 'missing-stock', 'invalid-stock']);
  });

  it('trusts Saldo when it does not match Cantidad - Ventas, and reports it', () => {
    const { entries, issues } = parse(row('*00420', 'CLAVO 10 x 25', { quantity: 4348, sales: 0, balance: 1739 }));
    expect(entries[0].stock).toBe('1739.000');
    expect(issues).toMatchObject([{ type: 'stock-mismatch', code: '00420' }]);
  });

  it('ignores zero, missing and invalid costs, reporting only the invalid ones', () => {
    const { entries, issues } = parse(
      row('*1', 'A', { balance: 1, cost: 0 }),
      row('*2', 'B', { balance: 1 }),
      row('*3', 'C', { balance: 1, cost: '<<<<' }),
      row('*4', 'D', { balance: 1, cost: new Date(0) }),
    );
    expect(entries.map((e) => e.costPrice)).toEqual([null, null, null, null]);
    expect(issues.map((i) => i.type)).toEqual(['invalid-cost', 'invalid-cost']);
  });

  it('reports rows with a description but no code', () => {
    const { entries, issues } = parse(row(null, 'UNION DOBLE', { balance: 2 }), [null, null]);
    expect(entries).toEqual([]);
    expect(issues).toMatchObject([{ type: 'missing-code', description: 'UNION DOBLE' }]);
  });

  it('fails when the header row is missing', () => {
    expect(() => parseStockSheet([row('*1', 'A')])).toThrow(/Header row/);
  });
});

describe('resolveDuplicateCodes', () => {
  const { entries } = parse(
    row('*20140', 'BISAGRA MUNICIÓN 60x60', { balance: 1 }),
    row('*20140', 'BOCA DE ACCESO AWADUCT 63 x 50', { balance: 3 }),
    row('*99999', 'NUEVO A', { balance: 1 }),
    row('*99999', 'NUEVO B', { balance: 2 }),
  );

  it('keeps the row matching the product already in the database, ignoring case and accents', () => {
    const result = resolveDuplicateCodes(entries, new Map([['20140', 'Boca  de acceso awaduct 63 x 50']]));

    expect(result.entries.map((e) => [e.code, e.description])).toEqual([
      ['20140', 'BOCA DE ACCESO AWADUCT 63 x 50'],
      ['99999', 'NUEVO A'],
    ]);
    expect(result.issues).toMatchObject([
      { type: 'duplicate-code', code: '20140', description: 'BISAGRA MUNICIÓN 60x60', sourceRow: 3 },
      { type: 'duplicate-code', code: '99999', description: 'NUEVO B', sourceRow: 6 },
    ]);
  });
});
