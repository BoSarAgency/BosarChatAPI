import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function generateSwaggerJson() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('BoSar API')
    .setDescription('API for BoSar chat management dashboard')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Write the swagger.json file
  const outputPath = join(process.cwd(), 'swagger.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  console.log(`Swagger JSON generated at: ${outputPath}`);

  await app.close();
}

generateSwaggerJson().catch((error) => {
  console.error('Error generating Swagger JSON:', error);
  process.exit(1);
});
