import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import { normalizeCode } from './product-code.js';

export interface ProductSearchResult {
  id: number;
  code: string;
  description: string;
  salePrice: Prisma.Decimal;
  // Cast to float8 in SQL: up to 3 decimals fit exactly and the JSON gets a number, not a string
  stock: number;
  minStock: number;
  categoryName: string | null;
}

const MAX_TERMS = 6;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Matches an exact or partial code (what the scanner sends) or every word of the
   * description, ignoring case and accents. Exact code matches come first.
   */
  search(query: string, limit: number): Promise<ProductSearchResult[]> {
    const code = normalizeCode(query);
    const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
    const descriptionMatches = terms.map(
      (term) => Prisma.sql`unaccent(p."description") ILIKE unaccent(${`%${escapeLike(term)}%`})`,
    );

    return this.prisma.$queryRaw<ProductSearchResult[]>`
      SELECT p."id", p."code", p."description", p."salePrice", p."stock"::float8 AS "stock", p."minStock",
             c."name" AS "categoryName"
      FROM "Product" p
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      WHERE p."active"
        AND (p."code" LIKE ${`${escapeLike(code)}%`} OR (${Prisma.join(descriptionMatches, ' AND ')}))
      ORDER BY (p."code" = ${code}) DESC, p."description"
      LIMIT ${limit}
    `;
  }

  /** Creates a product (e.g. a scanned code that isn't in the catalog yet) with its opening stock. */
  async create(dto: CreateProductDto): Promise<ProductSearchResult> {
    const stock = new Prisma.Decimal(dto.stock);
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            code: dto.code,
            description: dto.description,
            stock,
            costPrice: dto.costPrice === undefined ? null : new Prisma.Decimal(dto.costPrice),
            salePrice: new Prisma.Decimal(dto.salePrice ?? 0),
            minStock: dto.minStock,
            categoryId: dto.categoryId,
          },
          select: {
            id: true,
            code: true,
            description: true,
            salePrice: true,
            stock: true,
            minStock: true,
            category: { select: { name: true } },
          },
        });
        if (stock.gt(0)) {
          await tx.stockMovement.create({
            data: { productId: created.id, type: 'ENTRY', quantity: stock, stockAfter: stock, note: 'New product' },
          });
        }
        return created;
      });
      const { category, ...rest } = product;
      return { ...rest, stock: product.stock.toNumber(), categoryName: category?.name ?? null };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException(`Product code ${dto.code} already exists`);
        if (error.code === 'P2003') throw new BadRequestException(`Category ${dto.categoryId} not found`);
      }
      throw error;
    }
  }

  listCategories() {
    return this.prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }
}
