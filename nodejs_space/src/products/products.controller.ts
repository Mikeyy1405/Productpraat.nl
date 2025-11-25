import { Controller, Get, Post, Body, Param, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ImportProductsDto } from './dto/import-products.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Importeer producten van Bol.com',
    description: 'Haalt top producten op van Bol.com uit meerdere categorieën en genereert automatisch AI reviews',
  })
  @ApiBody({ type: ImportProductsDto })
  @ApiResponse({ status: 201, description: 'Producten succesvol geïmporteerd' })
  async importProducts(@Body() dto: ImportProductsDto) {
    this.logger.log(`📦 Import request ontvangen: ${dto.categories.join(', ')}`);
    const result = await this.productsService.importProducts(dto.categories, dto.limit);
    this.logger.log(`✅ Import voltooid: ${result.imported} producten toegevoegd`);
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Haal alle producten op' })
  @ApiResponse({ status: 200, description: 'Lijst van alle producten' })
  async getAllProducts() {
    this.logger.log('📋 Alle producten ophalen');
    return this.productsService.getAllProducts();
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Haal producten op per categorie' })
  @ApiParam({ name: 'category', description: 'Categorie naam (bijv. elektronica, wonen, sport)' })
  @ApiResponse({ status: 200, description: 'Producten in de opgegeven categorie' })
  async getProductsByCategory(@Param('category') category: string) {
    this.logger.log(`📋 Producten ophalen voor categorie: ${category}`);
    return this.productsService.getProductsByCategory(category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Haal één product op' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product niet gevonden' })
  async getProduct(@Param('id') id: string) {
    this.logger.log(`📋 Product ophalen: ${id}`);
    return this.productsService.getProductById(id);
  }
}