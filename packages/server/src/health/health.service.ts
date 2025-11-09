import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version?: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  database: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

@Injectable()
export class HealthService {
  private startTime: number;

  constructor(private prisma: PrismaService) {
    this.startTime = Date.now();
  }

  /**
   * Basic health check
   */
  check(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000), // uptime in seconds
      version: process.env.npm_package_version || '1.2.0',
    };
  }

  /**
   * Detailed health check with database and memory info
   */
  async detailedCheck(): Promise<DetailedHealthStatus> {
    const basic = this.check();
    const memUsage = process.memoryUsage();

    // Test database connection
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let dbResponseTime: number | undefined;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - start;
      dbStatus = 'connected';
    } catch (error) {
      console.error('[Health] Database check failed:', error);
      dbStatus = 'disconnected';
    }

    return {
      ...basic,
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
    };
  }

  /**
   * Readiness check - determines if the service is ready to accept traffic
   * This should check all critical dependencies
   */
  async checkReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    checks: Record<string, boolean>;
  }> {
    const checks: Record<string, boolean> = {};

    // Check database connectivity
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      console.error('[Health] Database readiness check failed:', error);
      checks.database = false;
    }

    // Check if environment is configured
    checks.environment = !!(process.env.JWT_SECRET && process.env.DATABASE_URL);

    // Determine overall readiness
    const isReady = Object.values(checks).every(check => check === true);

    return {
      status: isReady ? 'ready' : 'not_ready',
      checks,
    };
  }
}
