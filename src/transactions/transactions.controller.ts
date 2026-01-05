import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { TransactionStats } from '../dto/schema.dto';
import { TransactionsService } from './transactions.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetTransactionsQueryDto } from './dto/transaction-query.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Transactions')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('transactions/latest')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(30)
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of results (0-100)',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination' })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description:
      'Filter by action type (e.g., /cosmos.bank.v1beta1.MsgSend or use % for wildcards)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format: 2025-10-01T00:00:00)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format: 2025-10-31T23:59:59)',
  })
  @ApiQuery({
    name: 'heightWindow',
    required: false,
    type: Number,
    description: 'How many blocks back from the current max height to include (default 1000)',
  })
  @ApiQuery({
    name: 'beforeHeight',
    required: false,
    type: Number,
    description:
      'Height of the last transaction from the previous page; the next batch will return entries strictly older than this height within the requested window.',
  })
  async getLatestTransactions(@Query() query: GetTransactionsQueryDto) {
    return this.transactionsService.getLatestTransactions(
      query.limit,
      query.offset,
      query.action,
      query.startDate,
      query.endDate,
      query.heightWindow,
      query.beforeHeight,
    );
  }

  @Get('transactions/stats')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(300)
  async getTransactionStats(): Promise<TransactionStats | Record<string, never>> {
    return this.transactionsService.getTransactionStats();
  }

  @Get('transactions/message-types')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(600)
  async getMessageTypes() {
    return this.transactionsService.getMessageTypes();
  }

  @Get('transaction/:txHash')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getTransactionDetail(@Param('txHash') txHash: string) {
    const result = await this.transactionsService.getTransactionDetail(txHash);

    if ('error' in result && typeof result.error === 'string') {
      if (result.error.toLowerCase().includes('not found')) {
        throw new NotFoundException(result.error);
      }
      throw new HttpException(result.error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result;
  }
}
