import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CodeDetails, CodesResponse } from '../dto/schema.dto';
import { CodesService } from './codes.service';
import { CodesQueryDto } from './dto/codes-query.dto';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Codes')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class CodesController {
  constructor(private readonly codesService: CodesService) {}

  @Get('codes')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  // @ApiQuery({ name: 'limit', required: false, type: Number })
  // @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'height_min', required: false, type: Number })
  @ApiQuery({ name: 'height_max', required: false, type: Number })
  @ApiQuery({ name: 'code_id', required: false, type: String })
  @ApiQuery({ name: 'sender', required: false, type: String })
  async getCodes(@Query() query: CodesQueryDto): Promise<CodesResponse> {
    if (
      query.height_min !== undefined &&
      query.height_max !== undefined &&
      query.height_min > query.height_max
    ) {
      throw new HttpException(
        'height_min cannot be greater than height_max',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.codesService.getCodeStores(query);
  }

  @Get('code/details/:codeId')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getCodeDetails(@Param('codeId') codeId: string): Promise<CodeDetails> {
    const details = await this.codesService.getCodeDetails(codeId);

    if ('error' in details) {
      throw new HttpException(details.error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return details;
  }
}
