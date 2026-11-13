import { categorize } from './category-rules.js';

describe('categorize', () => {
  it.each([
    ['CABLE UNIPOLAR 1 x 2,5 NORMALIZADO', 'electrical'],
    ['LLAVE TERMICA SICA 2 x 32', 'electrical'],
    ['LLAVE DE PASO ESFERICA 1/2', 'plumbing'],
    ['LLAVE COMBINADA 11MM ECO SATINADA', 'tools'],
    ['CAÑO DE ALUMINIO P/GAS 5/16 175xmetro', 'gas'],
    ['Caño Hierro 3/4¨ x mt. - ACERTUBO', 'plumbing'],
    ['ENCH 3/4 R/ HEMBRA 1 POLIET.', 'plumbing'],
    ['DESBORDE TIPO FRANKLIN EXTRA CHATO (c/ regulador)', 'plumbing'],
    ['GUANTE CORTO LIVIANO 9 (Par.) TA*CO LATEX', 'tools'],
    ['TORNILLOS PARKER 14 x 11/2', 'fasteners'],
    ['CERRADURA PRIVE ART. 214 SEG. P/PUERTA CORREDIZA', 'locks-hardware'],
    ['LATEX PRO INTERIOR x 4 LT', 'paint'],
    ['Cartucho Silicona Negro x 280 ml', 'adhesives-construction'],
    ['ABRELATA UNIA NUPCIAL', 'uncategorized'],
  ])('%s -> %s', (description, expected) => {
    expect(categorize(description)).toBe(expected);
  });

  it('matches whole words only', () => {
    // "TEE" must not match inside "TEEN", "GAS" must not match inside "GASTON"
    expect(categorize('REMERA TEEN GASTON')).toBe('uncategorized');
  });
});
