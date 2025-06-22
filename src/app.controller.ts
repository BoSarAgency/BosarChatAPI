import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'API is running' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'API health status' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ACQG API',
      version: '1.0.0',
    };
  }

  @Get('health/websocket')
  @ApiOperation({ summary: 'WebSocket health check endpoint' })
  @ApiResponse({ status: 200, description: 'WebSocket service health status' })
  getWebSocketHealth() {
    return {
      status: 'healthy',
      websocket: 'available',
      timestamp: new Date().toISOString(),
      endpoint: '/chat',
      features: {
        heartbeat: true,
        stickySession: true,
        authentication: true,
        widgetSupport: true,
        reconnection: true,
      },
      configuration: {
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
      },
    };
  }
}
