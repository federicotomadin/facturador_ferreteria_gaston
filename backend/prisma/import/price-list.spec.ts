import { normalizeCode, normalizeSupplier, parsePrice, parsePriceList } from './price-list.js';

const HEADER = ['Código', 'Producto', 'Cód. Prov', 'Prov', 'Precio', '', '', '', ''];
const row = (...cells: string[]) => [...cells, ...Array(9 - cells.length).fill('')];

describe('normalizeCode', () => {
  it('strips the Code 39 asterisk delimiters', () => {
    expect(normalizeCode('*00001')).toBe('00001');
    expect(normalizeCode(' *20013* ')).toBe('20013');
  });
});

describe('parsePrice', () => {
  it('rounds to 2 decimals', () => {
    expect(parsePrice('181.5')).toBe('181.50');
    expect(parsePrice('0.7488')).toBe('0.75');
  });

  it('rejects empty and non-numeric values', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
  });
});

describe('normalizeSupplier', () => {
  it('unifies casing and known aliases', () => {
    expect(normalizeSupplier('ADRI').name).toBe('Adri');
    expect(normalizeSupplier('calvo Elec').name).toBe('Calvo Elec');
    expect(normalizeSupplier('Louzam').name).toBe('Louzan');
  });

  it('keeps mixed-case names as written', () => {
    expect(normalizeSupplier('AyCA').name).toBe('AyCA');
  });

  it('keeps the first supplier when several are listed', () => {
    expect(normalizeSupplier('Adri / Ger')).toEqual({ name: 'Adri', others: ['Ger'] });
  });

  it('returns null for an empty supplier', () => {
    expect(normalizeSupplier('  ').name).toBeNull();
  });
});

describe('parsePriceList', () => {
  it('parses a valid row', () => {
    const { products, issues } = parsePriceList([
      HEADER,
      row('*00001', 'ABRASIVO DISCO  C/VELCRO 5" GR. 40 KOLN ', 'KOLAD40', 'Adri', '181.5'),
    ]);

    expect(issues).toEqual([]);
    expect(products).toEqual([
      {
        code: '00001',
        description: 'ABRASIVO DISCO C/VELCRO 5" GR. 40 KOLN',
        supplierCode: 'KOLAD40',
        supplier: 'Adri',
        salePrice: '181.50',
        category: 'tools',
        sourceRow: 2,
      },
    ]);
  });

  it('keeps the first row of a duplicated code and reports the rest', () => {
    const { products, issues } = parsePriceList([
      HEADER,
      row('*30442', 'TORNILLO A', '', 'Adri', '10'),
      row('*30442', 'TORNILLO B', '', 'Adri', '20'),
    ]);

    expect(products.map((p) => p.description)).toEqual(['TORNILLO A']);
    expect(issues).toMatchObject([{ type: 'duplicate-code', sourceRow: 3, code: '30442' }]);
  });

  it('imports zero and missing prices as 0 and reports them', () => {
    const { products, issues } = parsePriceList([
      HEADER,
      row('*00005', 'ABRAZADERA 8-16', '', 'Adri', '0'),
      row('*00060', 'ABRAZADERA 10-20', '', 'Adri', ''),
    ]);

    expect(products.map((p) => p.salePrice)).toEqual(['0.00', '0.00']);
    expect(issues.map((i) => i.type)).toEqual(['zero-price', 'missing-price']);
  });

  it('skips rows without a code and reports values in unnamed columns', () => {
    const { products, issues } = parsePriceList([
      HEADER,
      row('', 'PRODUCTO SIN CODIGO', '', '', '5'),
      row('*00050', 'ALAMBRE NEGRO N° 12', '', 'Ima', '364', '300'),
    ]);

    expect(products.map((p) => p.code)).toEqual(['00050']);
    expect(issues).toMatchObject([
      { type: 'missing-code', sourceRow: 2 },
      { type: 'unnamed-columns', sourceRow: 3, detail: '300' },
    ]);
  });
});
