import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { FileLogger } from './common/logger/file.logger';

async function bootstrap(): Promise<void> {
  const logger = new FileLogger();
  const app = await NestFactory.create(AppModule, { logger });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ZIGScan API')
    .setDescription('ZIGChain Blockchain data endpoints')
    .setVersion('2.0')
    // src/main.ts:14
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'API Key', in: 'header' },
      'api-key',
    )

    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableCors({
    origin: true,
    credentials: true,
    methods: '*',
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const configService = app.get(ConfigService);
  const host = configService.get<string>('api.host', '0.0.0.0');
  const port = configService.get<number>('api.port', 8000);

  await app.listen(port, host);
}

bootstrap().catch(error => {
  const logger = new FileLogger('Bootstrap');
  logger.error('Failed to bootstrap application', error.stack ?? error.message);
  process.exit(1);
});
