import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Requires the local database: `docker compose up -d` at the repo root
const CODE_PREFIX = 'E2E-';

describe('Products search and sales (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hammer: { id: number };
  let pipe: { id: number };
  let unpriced: { id: number };

  const cleanUp = async () => {
    const products = await prisma.product.findMany({
      where: { code: { startsWith: CODE_PREFIX } },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    const sales = await prisma.saleItem.findMany({
      where: { productId: { in: productIds } },
      select: { saleId: true },
    });
    const saleIds = sales.map((s) => s.saleId);
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
    await cleanUp();

    [hammer, pipe, unpriced] = await Promise.all([
      prisma.product.create({
        data: { code: `${CODE_PREFIX}001`, description: 'MARTILLO GALPONERO E2E', salePrice: '1500.50', stock: 10 },
      }),
      prisma.product.create({
        data: { code: `${CODE_PREFIX}002`, description: 'CAÑO PVC E2E 40MM', salePrice: '820.00', stock: 3 },
      }),
      prisma.product.create({
        data: { code: `${CODE_PREFIX}003`, description: 'PRODUCTO SIN PRECIO E2E', salePrice: '0', stock: 5 },
      }),
    ]);
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  const stockOf = async (id: number) =>
    (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

  describe('GET /api/products/search', () => {
    it('finds a product by its scanned code, with or without Code 39 asterisks', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/products/search')
        .query({ q: `*${CODE_PREFIX}001*` })
        .expect(200);
      expect(body[0]).toMatchObject({ code: `${CODE_PREFIX}001`, salePrice: '1500.5', stock: 10 });
    });

    it('matches every word of the description ignoring case and accents', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/products/search')
        .query({ q: 'cano e2e' })
        .expect(200);
      expect(body.map((p: { code: string }) => p.code)).toEqual([`${CODE_PREFIX}002`]);
    });

    it('rejects an empty query', () => {
      return request(app.getHttpServer()).get('/api/products/search').query({ q: '' }).expect(400);
    });
  });

  describe('POST /api/sales', () => {
    it('decrements stock, logs movements and returns the remaining stock per product', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/sales')
        .send({
          // Same product twice must be merged into one line
          items: [
            { productId: hammer.id, quantity: 1 },
            { productId: pipe.id, quantity: 2 },
            { productId: hammer.id, quantity: 1 },
          ],
        })
        .expect(201);

      expect(body.total).toBe('4641');
      expect(body.items).toEqual([
        expect.objectContaining({ productId: hammer.id, quantity: 2, stockAfter: 8, minStock: 5 }),
        expect.objectContaining({ productId: pipe.id, quantity: 2, stockAfter: 1, minStock: 5 }),
      ]);
      expect(await stockOf(hammer.id)).toBe(8);
      expect(await stockOf(pipe.id)).toBe(1);

      const movements = await prisma.stockMovement.findMany({ where: { saleId: body.id } });
      expect(movements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ productId: hammer.id, type: 'SALE', quantity: -2, stockAfter: 8 }),
          expect.objectContaining({ productId: pipe.id, type: 'SALE', quantity: -2, stockAfter: 1 }),
        ]),
      );
    });

    it('rejects the whole sale when one product has insufficient stock', async () => {
      const hammerStock = await stockOf(hammer.id);
      await request(app.getHttpServer())
        .post('/api/sales')
        .send({
          items: [
            { productId: hammer.id, quantity: 1 },
            { productId: pipe.id, quantity: 99 },
          ],
        })
        .expect(409);
      // Rolled back: the hammer line must not have been decremented either
      expect(await stockOf(hammer.id)).toBe(hammerStock);
    });

    it('allows products without a sale price (stock control only)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/sales')
        .send({ items: [{ productId: unpriced.id, quantity: 1 }] })
        .expect(201);
      expect(body.total).toBe('0');
      expect(await stockOf(unpriced.id)).toBe(4);
    });

    it('validates the payload', () => {
      return request(app.getHttpServer())
        .post('/api/sales')
        .send({ items: [{ productId: hammer.id, quantity: 0 }] })
        .expect(400);
    });

    it('never sells more than the available stock under concurrent requests', async () => {
      await prisma.product.update({ where: { id: pipe.id }, data: { stock: 1 } });
      const sell = () =>
        request(app.getHttpServer())
          .post('/api/sales')
          .send({ items: [{ productId: pipe.id, quantity: 1 }] });

      const statuses = (await Promise.all([sell(), sell(), sell()])).map((r) => r.status).sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);
      expect(await stockOf(pipe.id)).toBe(0);
    });
  });
});
