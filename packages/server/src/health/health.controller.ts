import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check endpoint
   * Returns 200 OK if the server is running
   */
  @Get()
  check() {
    return this.healthService.check();
  }

  /**
   * Detailed health check endpoint
   * Returns comprehensive health information including database status
   */
  @Get('detailed')
  async detailedCheck() {
    return this.healthService.detailedCheck();
  }

  /**
   * Readiness probe endpoint (for Kubernetes/container orchestration)
   * Returns 200 if the server is ready to accept traffic
   */
  @Get('ready')
  async ready() {
    return this.healthService.checkReadiness();
  }

  /**
   * Liveness probe endpoint (for Kubernetes/container orchestration)
   * Returns 200 if the server is alive and responsive
   */
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
