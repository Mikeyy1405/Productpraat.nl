import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    this.logger.log('Health check requested');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ProductPraat MVP Backend',
      version: '1.0.0',
    };
  }
}