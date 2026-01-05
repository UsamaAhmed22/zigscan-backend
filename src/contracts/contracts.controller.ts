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
  ContractsResponse,
  ContractDetails,
  ContractTransactionsResponse,
} from '../dto/schema.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ContractsService } from './contracts.service';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractTransactionsQueryDto } from './dto/contract-transactions-query.dto';

@ApiTags('Contracts')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('contracts')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getContracts(@Query() query: ContractsQueryDto): Promise<ContractsResponse> {
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

    return this.contractsService.getContracts(query);
  }

  @Get('contract/details/:contractAddress')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getContractDetails(
    @Param('contractAddress') contractAddress: string,
  ): Promise<ContractDetails> {
    const details = await this.contractsService.getContractDetails(contractAddress);

    if ('error' in details) {
      throw new HttpException(details.error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return details;
  }

  @Get('contract/transactions/:contractAddress')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(300)
  async getContractTransactions(
    @Param('contractAddress') contractAddress: string,
    @Query() pagination: ContractTransactionsQueryDto,
  ): Promise<ContractTransactionsResponse> {
    const normalizedAddress = contractAddress?.trim();

    if (!normalizedAddress) {
      throw new HttpException('contractAddress is required', HttpStatus.BAD_REQUEST);
    }

    return this.contractsService.getContractTransactions(normalizedAddress, pagination);
  }
}
