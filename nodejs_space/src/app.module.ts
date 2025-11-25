import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ProductsModule } from './products/products.module';
import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { BolModule } from './bol/bol.module';
import { AiReviewModule } from './ai-review/ai-review.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Serve React frontend als static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend', 'dist'),
      exclude: ['/api/*', '/health'],
    }),
    SupabaseModule,
    BolModule,
    AiReviewModule,
    ProductsModule,
    ArticlesModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}