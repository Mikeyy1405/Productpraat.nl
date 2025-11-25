import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class ImportProductsDto {
  @ApiProperty({
    description: 'Lijst van categorieën om te importeren',
    example: ['elektronica', 'wonen', 'sport'],
    type: [String],
  })
  @IsArray()
  categories: string[];

  @ApiProperty({
    description: 'Aantal producten per categorie',
    example: 5,
    minimum: 1,
    maximum: 10,
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}