import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('ProductPraat API')
    .setDescription('MVP Backend voor ProductPraat.nl - Product import en AI review generatie')
    .setVersion('1.0')
    .addTag('products', 'Product management en import')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customCss: fs.readFileSync(
      path.join(__dirname, '../custom-swagger.css'),
      'utf8',
    ),
    customSiteTitle: 'ProductPraat API Documentation',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 ProductPraat MVP Backend draait op poort ${port}`);
  logger.log(`📚 API Documentatie: http://localhost:${port}/api-docs`);
  logger.log(`❤️ Health Check: http://localhost:${port}/health`);
}

bootstrap();