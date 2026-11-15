import { Controller, Get } from '@nestjs/common';
import { ProductsService } from './products.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.listCategories();
  }
}
