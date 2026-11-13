import { type INestApplication, ValidationPipe } from '@nestjs/common';

// Shared by main.ts and the e2e tests so both run with the same validation and routes
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(','),
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  return app;
}
