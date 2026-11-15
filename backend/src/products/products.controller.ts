import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { SearchProductsDto } from './dto/search-products.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('search')
  search(@Query() { q, limit }: SearchProductsDto) {
    return this.products.search(q, limit);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }
}
