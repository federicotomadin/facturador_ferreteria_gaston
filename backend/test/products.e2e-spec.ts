import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Requires the local database: `docker compose up -d` at the repo root
const CODE_PREFIX = 'E2E-NEW-';

describe('Product creation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const cleanUp = async () => {
    const products = await prisma.product.findMany({
      where: { code: { startsWith: CODE_PREFIX } },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
    await cleanUp();
    await prisma.category.upsert({
      where: { slug: 'tools' },
      update: {},
      create: { slug: 'tools', name: 'Herramientas' },
    });
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  const create = (body: object) => request(app.getHttpServer()).post('/api/products').send(body);

  it('creates a scanned product with its opening stock and an ENTRY movement', async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'tools' } });
    const { body } = await create({
      code: ` *${CODE_PREFIX}001* `,
      description: '  DESTORNILLADOR PHILLIPS E2E  ',
      stock: 12.5,
      costPrice: 1000,
      salePrice: 1500.5,
      categoryId: category.id,
    }).expect(201);

    expect(body).toEqual({
      id: expect.any(Number),
      code: `${CODE_PREFIX}001`,
      description: 'DESTORNILLADOR PHILLIPS E2E',
      salePrice: '1500.5',
      stock: 12.5,
      minStock: 5,
      categoryName: 'Herramientas',
    });
    const movements = await prisma.stockMovement.findMany({ where: { productId: body.id } });
    expect(movements.map((m) => [m.type, m.quantity.toNumber(), m.stockAfter.toNumber()])).toEqual([
      ['ENTRY', 12.5, 12.5],
    ]);

    const { body: found } = await request(app.getHttpServer())
      .get('/api/products/search')
      .query({ q: `${CODE_PREFIX}001` })
      .expect(200);
    expect(found[0]).toMatchObject({ id: body.id, stock: 12.5 });
  });

  it('defaults price to 0 and skips the movement when there is no stock', async () => {
    const { body } = await create({ code: `${CODE_PREFIX}002`, description: 'SIN STOCK E2E', stock: 0 }).expect(201);
    expect(body).toMatchObject({ salePrice: '0', stock: 0, categoryName: null });
    expect(await prisma.stockMovement.count({ where: { productId: body.id } })).toBe(0);
  });

  it('rejects a code that already exists', async () => {
    await create({ code: `${CODE_PREFIX}003`, description: 'PRIMERO E2E', stock: 1 }).expect(201);
    await create({ code: `*${CODE_PREFIX}003*`, description: 'SEGUNDO E2E', stock: 1 }).expect(409);
  });

  it('rejects an unknown category', async () => {
    await create({ code: `${CODE_PREFIX}004`, description: 'CATEGORIA E2E', stock: 1, categoryId: 999_999 }).expect(400);
    expect(await prisma.product.count({ where: { code: `${CODE_PREFIX}004` } })).toBe(0);
  });

  it.each([
    { code: '**', description: 'SOLO ASTERISCOS', stock: 1 },
    { code: `${CODE_PREFIX}005`, description: ' ', stock: 1 },
    { code: `${CODE_PREFIX}005`, description: 'NEGATIVO', stock: -1 },
    { code: `${CODE_PREFIX}005`, description: 'DECIMALES', stock: 1.2345 },
    { code: `${CODE_PREFIX}005`, description: 'PRECIO', stock: 1, salePrice: 10.555 },
  ])('validates the payload %#', async (body) => {
    await create(body).expect(400);
  });

  it('lists categories by name', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/categories').expect(200);
    expect(body).toEqual(expect.arrayContaining([{ id: expect.any(Number), name: 'Herramientas' }]));
    const names = body.map((c: { name: string }) => c.name);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)));
  });
});
