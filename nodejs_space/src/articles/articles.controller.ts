import { Controller, Get, Post, Delete, Body, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { CreateArticleDto, GenerateArticleDto } from './dto/article.dto';

@ApiTags('Articles')
@Controller('api/articles')
export class ArticlesController {
  private readonly logger = new Logger(ArticlesController.name);

  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @ApiOperation({ summary: 'Haal alle artikelen op' })
  @ApiQuery({ name: 'type', required: false, enum: ['guide', 'comparison', 'informative'] })
  @ApiResponse({ status: 200, description: 'Lijst van artikelen' })
  async findAll(@Query('type') type?: string) {
    this.logger.log(`GET /api/articles${type ? `?type=${type}` : ''}`);
    
    if (type) {
      return this.articlesService.findByType(type);
    }
    
    return this.articlesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Haal één artikel op' })
  @ApiParam({ name: 'id', description: 'Artikel ID' })
  @ApiResponse({ status: 200, description: 'Artikel details' })
  @ApiResponse({ status: 404, description: 'Artikel niet gevonden' })
  async findOne(@Param('id') id: string) {
    this.logger.log(`GET /api/articles/${id}`);
    return this.articlesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Maak nieuw artikel aan (handmatig)' })
  @ApiResponse({ status: 201, description: 'Artikel aangemaakt' })
  async create(@Body() createArticleDto: CreateArticleDto) {
    this.logger.log(`POST /api/articles - ${createArticleDto.title}`);
    return this.articlesService.create(createArticleDto);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Genereer artikel met AI' })
  @ApiResponse({ status: 201, description: 'Artikel gegenereerd' })
  async generate(@Body() generateDto: GenerateArticleDto) {
    this.logger.log(`POST /api/articles/generate - ${generateDto.type}: ${generateDto.topic}`);
    return this.articlesService.generateArticle(
      generateDto.type,
      generateDto.topic,
      generateDto.category,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Verwijder artikel' })
  @ApiParam({ name: 'id', description: 'Artikel ID' })
  @ApiResponse({ status: 200, description: 'Artikel verwijderd' })
  async delete(@Param('id') id: string) {
    this.logger.log(`DELETE /api/articles/${id}`);
    await this.articlesService.delete(id);
    return { success: true, message: 'Artikel verwijderd' };
  }
}
