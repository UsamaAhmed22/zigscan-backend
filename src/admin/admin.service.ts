import { Injectable } from '@nestjs/common';
import { ApiKeyAuthService } from '../auth/api-key-auth.service';
import { ClickhouseService } from '../clickhouse/clickhouse.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly authService: ApiKeyAuthService,
    private readonly clickhouseService: ClickhouseService,
  ) {}

  async listUsers() {
    const [users, systemStats] = await Promise.all([
      this.authService.listUsers(),
      this.authService.getSystemStats(),
    ]);
    return {
      users,
      total_users: users.length,
      admin_window_active: false,
    };
  }

  async getSystemStats() {
    return this.authService.getSystemStats();
  }

  async executeAdminQuery(sql: string) {
    const data = await this.clickhouseService.executeQuery(sql);
    return {
      success: true,
      data,
      count: Array.isArray(data) ? data.length : 1,
    };
  }

  async getAuditLog(limit: number) {
    return this.authService.getAuditLog(limit);
  }
}
