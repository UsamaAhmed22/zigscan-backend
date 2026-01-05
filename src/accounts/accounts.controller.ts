import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
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
import {
  AccountDetails,
  AccountTransactionsResponse,
  DelegationList,
  TokenMetadata,
  ValdoraStaking,
  ValdoraStakingTransaction,
} from '../dto/schema.dto';
import { AccountsService } from './accounts.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccountTransactionsQueryDto } from './dto/account-transactions-query.dto';

@ApiTags('Accounts')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('account/details/:address')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getAccountDetails(@Param('address') address: string): Promise<AccountDetails> {
    const result = await this.accountsService.getAccountDetails(address);

    if ('error' in result) {
      const status = result.error.toLowerCase().includes('not found')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.BAD_REQUEST;
      throw new HttpException(result.error, status);
    }

    return result;
  }

  @Get('account/token-metadata')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(30)
  @ApiQuery({
    name: 'denom',
    required: true,
    description:
      'Denom or token identifier (native, factory, CW20, or IBC) to look up metadata for.',
  })
  async getTokenMetadata(
    @Query('denom') denom: string,
  ): Promise<{ denom: string; metadata: TokenMetadata }> {
    const result = await this.accountsService.getMetadataForDenom(denom);

    if ('error' in result) {
      throw new HttpException(result.error, HttpStatus.BAD_REQUEST);
    }

    return result;
  }

  @Get('account/delegations/:address')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getAccountDelegations(@Param('address') address: string): Promise<DelegationList> {
    const result = await this.accountsService.getAccountDelegations(address);

    if ('error' in result) {
      const normalized = result.error.toLowerCase();
      const status =
        normalized.includes('invalid') || normalized.includes('supported')
          ? HttpStatus.BAD_REQUEST
          : normalized.includes('not found')
            ? HttpStatus.NOT_FOUND
            : HttpStatus.BAD_GATEWAY;
      throw new HttpException(result.error, status);
    }

    return result;
  }

  @Get('accounts/total')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getAccountsTotal(): Promise<{ total: number }> {
    const result = await this.accountsService.getAccountsTotal();

    if ('error' in result) {
      throw new HttpException(result.error, HttpStatus.BAD_GATEWAY);
    }

    return result;
  }

  @Get('account/transactions/:address')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getAccountTransactions(
    @Param('address') address: string,
    @Query() pagination: AccountTransactionsQueryDto,
  ): Promise<AccountTransactionsResponse> {
    const result = await this.accountsService.getAccountTransactions(address, pagination);

    if ('error' in result) {
      const normalized = result.error.toLowerCase();
      const status =
        normalized.includes('invalid') || normalized.includes('supported')
          ? HttpStatus.BAD_REQUEST
          : normalized.includes('not found')
            ? HttpStatus.NOT_FOUND
            : HttpStatus.BAD_GATEWAY;
      throw new HttpException(result.error, status);
    }

    return result;
  }
}
