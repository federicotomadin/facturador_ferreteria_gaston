export interface CategoryDefinition {
  slug: string;
  // Shown in the UI, so it's in Spanish
  name: string;
}

export const CATEGORIES = [
  { slug: 'electrical', name: 'Electricidad' },
  { slug: 'plumbing', name: 'Agua y sanitarios' },
  { slug: 'gas', name: 'Gas' },
  { slug: 'tools', name: 'Herramientas' },
  { slug: 'fasteners', name: 'Fijaciones' },
  { slug: 'locks-hardware', name: 'Cerrajería y herrajes' },
  { slug: 'paint', name: 'Pinturería' },
  { slug: 'adhesives-construction', name: 'Adhesivos y construcción' },
  { slug: 'uncategorized', name: 'Sin clasificar' },
] as const satisfies readonly CategoryDefinition[];

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export const FALLBACK_CATEGORY: CategorySlug = 'uncategorized';

type Rule = [CategorySlug, string[]];

// Evaluated in order, first match wins. Multi-word phrases go first so that
// ambiguous words (LLAVE, CAJA, CINTA, TAPA) are resolved by context.
// Patterns are matched as whole words against the accent-free, uppercased description.
const RULES: Rule[] = [
  // Words that would otherwise be caught by a weaker keyword (e.g. "GUANTE LATEX", "DESBORDE C/ REGULADOR")
  ['tools', ['GUANTE', 'GUANTES', 'PISTOLA']],
  ['plumbing', ['DESBORDE', 'DESCARGA', 'FLAPPER']],
  ['gas', ['GAS', 'GARRAFA', 'REGULADOR', 'REGULADORES', 'SIGAS', 'TERMOCUPLA']],
  [
    'plumbing',
    [
      'LLAVE DE PASO', 'LLAVE PASO', 'CINTA TEFLON', 'TAPA INODORO', 'CEMENTO PVC', 'ENCH', 'HAKAN',
      'POLIPROPILENO', 'POLIPROP', 'TERMOFUSION', 'DUCHADOR',
    ],
  ],
  [
    'electrical',
    [
      'LLAVE TERMICA', 'LLAVE DE LUZ', 'LLAVE DIFERENCIAL', 'LLAVE PUNTO', 'LLAVE COMBINACION',
      'CAJA DE LUZ', 'CAJA RECTANGULAR', 'CAJA OCTOGONAL', 'CAJA CUADRADA', 'CAJA CAPSULADA',
      'CAJA EMBUTIR', 'CAJA EXTERIOR', 'CAJA ESTANCA', 'CINTA AISLADORA', 'TAPA DE LUZ', 'TAPA CIEGA',
      'TUBO LED', 'TUBOS LED',
    ],
  ],
  [
    'tools',
    [
      'LLAVE FRANCESA', 'LLAVE COMBINADA', 'LLAVE ALLEN', 'LLAVE STILSON', 'LLAVE ESTRIADA',
      'LLAVE FIJA', 'LLAVE TUBO', 'LLAVES ALLEN', 'LLAVES COMBINADAS', 'CINTA METRICA',
      'CAJA DE HERRAMIENTAS', 'CAJA HERRAMIENTAS',
    ],
  ],
  [
    'electrical',
    [
      'CABLE', 'CABLES', 'LAMPARA', 'LAMPARAS', 'PORTALAMPARA', 'FICHA', 'FICHAS', 'ENCHUFE',
      'BUSCAPOLO', 'CAPACITOR', 'TUBOFLEX',
      'ZAPATILLA', 'TOMA', 'TOMACORRIENTE', 'INTERRUPTOR', 'TERMICA', 'DISYUNTOR', 'LED', 'FLUOR',
      'PILA', 'PILAS', 'ZUMBADOR', 'TIMBRE', 'PROLONGADOR', 'CORRUGADO', 'BORNERA', 'CONTACTOR',
      'REFLECTOR', 'ARTEFACTO', 'MODULO', 'TECLA', 'COAXIL', 'CONECTOR', 'CONECTORTV', 'VELADOR',
      'LINTERNA', 'RESISTENCIA', 'FUSIBLE', 'TRANSFORMADOR', 'SENSOR', 'FOTOCELULA', 'PRECINTO',
      'PRECINTOS', 'TERMINAL', 'TERMINALES', 'ADAPTADOR', 'DICROICA', 'PLAFON', 'ARANA',
    ],
  ],
  [
    'plumbing',
    [
      'CODO', 'CODOS', 'CUPLA', 'CUPLAS', 'TEE', 'RAMAL', 'CANILLA', 'CANILLAS', 'CABEZAL', 'FLEXIBLE',
      'VALVULA', 'VALVULITA', 'NIPLE', 'UNION', 'REDUCCION', 'TAPON', 'BOYA', 'DESBORDE', 'CANO',
      'CANOS', 'CURVA', 'MANGUERA', 'SIFON', 'DUCHA', 'GRIFERIA', 'CONEXION', 'INODORO', 'DEPOSITO',
      'BIDET', 'TANQUE', 'BRIDA', 'TEFLON', 'AWADUCT', 'AWAFUSION', 'PILETA', 'REJILLA', 'COLECTOR',
      'TRANSICION', 'ACOPLE', 'LLUVIA', 'FUELLE', 'MONOCOMANDO', 'BACHA', 'CAMARA', 'PICO', 'TAPAJUNTA',
    ],
  ],
  [
    'paint',
    [
      'LATEX', 'AEROSOL', 'AEROSOLES', 'ESMALTE', 'PINTURA', 'BARNIZ', 'DILUYENTE', 'THINNER',
      'AGUARRAS', 'ENDUIDO', 'FIJADOR', 'MEMBRANA', 'IMPERMEABILIZANTE', 'SINTETICO', 'RODILLO',
      'PINCEL', 'MASILLA', 'ENTONADOR', 'CONVERTIDOR', 'ANTIOXIDO',
    ],
  ],
  [
    'fasteners',
    [
      'TORNILLO', 'TORNILLOS', 'BULON', 'BULONES', 'ARANDELA', 'ARANDELAS', 'CLAVO', 'CLAVOS',
      'TARUGO', 'TARUGOS', 'TIRAFONDO', 'TIRAFONDOS', 'REMACHE', 'REMACHES', 'TUERCA', 'TUERCAS',
      'PITON', 'PITONES', 'GRAMPA', 'GRAMPAS', 'GRAMPITA', 'GRAMPYTA', 'ESPARRAGO', 'ABRAZADERA',
      'ABRAZADERAS', 'GANCHO', 'GANCHOS', 'AUTOPERFORANTE', 'AUTOPERFORANTES',
    ],
  ],
  [
    'locks-hardware',
    [
      'CERRADURA', 'CERRADURAS', 'CANDADO', 'CANDADOS', 'BISAGRA', 'BISAGRAS', 'PASADOR', 'MANIJA',
      'MANIJAS', 'PICAPORTE', 'CERROJO', 'CILINDRO', 'ESCUADRA', 'SOPORTE', 'SOPORTES', 'MENSULA',
      'REGATON', 'MOSQUETON', 'CADENA', 'LINGA', 'ARGOLLA', 'ARGOLLAS', 'SOGA', 'BARRAL', 'LLAVERO',
      'PERCHA', 'RUEDA', 'RUEDAS', 'REJA', 'PLANCHUELA', 'ESQUINERO', 'ALAMBRE', 'HILO', 'TIRADOR',
      'PORTACANDADO', 'TOPE', 'CORREDERA', 'CABO', 'TENSOR', 'GUARDACABO',
    ],
  ],
  [
    'tools',
    [
      'MECHA', 'MECHAS', 'DESTORNILLADOR', 'DEST', 'PINZA', 'TIJERA', 'ESPATULA', 'NIVEL', 'PISTOLA',
      'MARTILLO', 'SERRUCHO', 'DISCO', 'DISCOS', 'LIJA', 'LIJAS', 'ABRASIVO', 'CEPILLO', 'CUTTER',
      'TRINCHETA', 'METRO', 'FORMON', 'SIERRA', 'HOJA', 'BROCA', 'PUNTA', 'PUNTAS', 'ALICATE', 'MAZA',
      'TENAZA', 'CUCHARA', 'LLANA', 'FRATACHO', 'PLOMADA', 'PLOMADAS', 'PRENSA', 'ELECTRODOS',
      'ESCALERA', 'PIEDRA', 'MASCARA', 'ANTEOJO', 'GUANTE', 'GUANTES', 'TANZA', 'LAPIZ', 'SOPLETE',
      'REMACHADORA', 'BALDE', 'PALA', 'CARRETILLA', 'LLAVE', 'LLAVES', 'BOCALLAVE', 'TALADRO',
      'AMOLADORA', 'TESTER', 'ENGRAPADORA', 'SOLDADOR', 'ESTANO', 'ESTANIO', 'CORTAFIERRO', 'PUNZON',
      'ESCOFINA', 'MANDRIL',
    ],
  ],
  [
    'adhesives-construction',
    [
      'CEMENTO', 'CAL', 'YESO', 'PEGAMENTO', 'ADHESIVO', 'SILICONA', 'SELLADOR', 'FASTIX', 'ESPUMA',
      'POXIPOL', 'POXILINA', 'LA GOTITA', 'COLA', 'CINTA', 'CINTAS', 'PASTINA', 'MALLA', 'DURLOCK',
      'HIDROFUGO',
    ],
  ],
];

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COMPILED_RULES = RULES.map(([slug, keywords]) => ({
  slug,
  pattern: new RegExp(
    `(?<![A-Z0-9])(?:${keywords.map(escapeRegExp).join('|')})(?![A-Z0-9])`,
  ),
}));

export function categorize(description: string): CategorySlug {
  const text = normalize(description);
  return COMPILED_RULES.find(({ pattern }) => pattern.test(text))?.slug ?? FALLBACK_CATEGORY;
}
