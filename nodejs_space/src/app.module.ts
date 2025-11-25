import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductsModule } from './products/products.module';
import { HealthController } from './health/health.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { BolModule } from './bol/bol.module';
import { AiReviewModule } from './ai-review/ai-review.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    BolModule,
    AiReviewModule,
    ProductsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}