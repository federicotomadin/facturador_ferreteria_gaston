import { Controller, Get, Query } from '@nestjs/common';
import { SearchProductsDto } from './dto/search-products.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('search')
  search(@Query() { q, limit }: SearchProductsDto) {
    return this.products.search(q, limit);
  }
}
