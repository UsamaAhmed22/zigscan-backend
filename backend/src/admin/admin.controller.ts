import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiKey } from '../auth/decorators/auth-context.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminExecuteQueryDto } from './dto/execute-query.dto';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth('api-key')
@Controller('api/v2/admin')
@UseGuards(ApiKeyGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('system-stats')
  getSystemStats() {
    return this.adminService.getSystemStats();
  }

  @Post('execute-query')
  async executeQuery(@Query() query: AdminExecuteQueryDto, @ApiKey() apiKey?: string) {
    const result = await this.adminService.executeAdminQuery(query.sql);
    return {
      ...result,
      executed_by: apiKey ? `${apiKey.slice(0, 8)}...` : 'unknown',
    };
  }

  @Get('audit-log')
  getAuditLog(@Query() query: AuditLogQueryDto) {
    return this.adminService.getAuditLog(query.limit);
  }
}
