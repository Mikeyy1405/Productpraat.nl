import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AiReviewModule } from '../ai-review/ai-review.module';

@Module({
  imports: [SupabaseModule, AiReviewModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
