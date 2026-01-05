import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';

@ApiTags('API Keys')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('api/v2/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({
    summary: 'Generate a new API key',
    description:
      'Generates a new admin or user API key. Only allow-listed issuer accounts can call this route.',
  })
  create(@Request() req: any, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.createApiKey(req.user.id, req.user.email, dto);
  }
}
