import { Module } from '@nestjs/common';
import { AiReviewService } from './ai-review.service';

@Module({
  providers: [AiReviewService],
  exports: [AiReviewService],
})
export class AiReviewModule {}