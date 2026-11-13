import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSaleDto } from './dto/create-sale.dto.js';
import { mergeItems } from './merge-items.js';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSaleDto) {
    const items = mergeItems(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, active: true },
        select: { id: true, code: true, description: true, salePrice: true },
      });
      const productsById = new Map(products.map((p) => [p.id, p]));

      const lines = items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new BadRequestException(`Product ${item.productId} not found or inactive`);
        }
        const quantity = new Prisma.Decimal(item.quantity);
        return { ...product, quantity, subtotal: product.salePrice.mul(quantity).toDecimalPlaces(2) };
      });

      const results = [];
      for (const line of lines) {
        // Conditional decrement: concurrent sales can't take the stock below zero
        const updated = await tx.product
          .update({
            where: { id: line.id, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
            select: { stock: true, minStock: true },
          })
          .catch((error: unknown) => {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              throw new ConflictException(`Insufficient stock for product ${line.code}`);
            }
            throw error;
          });
        results.push({ ...line, stockAfter: updated.stock, minStock: updated.minStock });
      }

      const sale = await tx.sale.create({
        data: {
          total: lines.reduce((sum, l) => sum.add(l.subtotal), new Prisma.Decimal(0)),
          items: {
            create: lines.map((l) => ({
              productId: l.id,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.salePrice,
              subtotal: l.subtotal,
            })),
          },
          movements: {
            createMany: {
              data: results.map((r) => ({
                productId: r.id,
                type: 'SALE' as const,
                quantity: r.quantity.neg(),
                stockAfter: r.stockAfter,
              })),
            },
          },
        },
        select: { id: true, total: true, createdAt: true },
      });

      return {
        ...sale,
        items: results.map((r) => ({
          productId: r.id,
          code: r.code,
          description: r.description,
          quantity: r.quantity.toNumber(),
          stockAfter: r.stockAfter.toNumber(),
          minStock: r.minStock,
        })),
      };
    });
  }
}
