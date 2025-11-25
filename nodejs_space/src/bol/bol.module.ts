import { Module } from '@nestjs/common';
import { BolService } from './bol.service';

@Module({
  providers: [BolService],
  exports: [BolService],
})
export class BolModule {}