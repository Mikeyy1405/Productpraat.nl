import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { BolModule } from '../bol/bol.module';
import { AiReviewModule } from '../ai-review/ai-review.module';

@Module({
  imports: [BolModule, AiReviewModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}