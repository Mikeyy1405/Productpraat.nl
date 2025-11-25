import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ 
    description: 'Type artikel',
    enum: ['guide', 'comparison', 'informative']
  })
  @IsEnum(['guide', 'comparison', 'informative'])
  type: 'guide' | 'comparison' | 'informative';

  @ApiProperty({ description: 'Titel van het artikel' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Categorie' })
  @IsString()
  category: string;

  @ApiProperty({ description: 'Inhoud van het artikel' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'SEO titel', required: false })
  @IsOptional()
  @IsString()
  seo_title?: string;

  @ApiProperty({ description: 'SEO beschrijving', required: false })
  @IsOptional()
  @IsString()
  seo_description?: string;
}

export class GenerateArticleDto {
  @ApiProperty({ 
    description: 'Type artikel om te genereren',
    enum: ['guide', 'comparison', 'informative'],
    example: 'guide'
  })
  @IsEnum(['guide', 'comparison', 'informative'])
  type: 'guide' | 'comparison' | 'informative';

  @ApiProperty({ 
    description: 'Onderwerp/titel voor het artikel',
    example: 'Beste Laptops van 2024'
  })
  @IsString()
  topic: string;

  @ApiProperty({ 
    description: 'Product categorie',
    example: 'elektronica'
  })
  @IsString()
  category: string;
}
