import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { Validator, ValidatorsResponse, ValidatorDetails } from '../dto/schema.dto';
import { ValidatorsQueryDto } from './dto/validators-query.dto';
import { KeybaseService } from './keybase.service';

@Injectable()
export class ValidatorsService {
  private readonly logger = new Logger(ValidatorsService.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly keybaseService: KeybaseService,
  ) {}

  async getValidators(query: ValidatorsQueryDto): Promise<ValidatorsResponse> {
    try {
      const response = await this.blockchainService.getFromApi<Record<string, any>>(
        '/cosmos/staking/v1beta1/validators',
        {
          params: {
            status: query.status ?? 'BOND_STATUS_BONDED',
            'pagination.limit': query.limit,
            'pagination.offset': query.offset,
          },
        },
      );

      if (response.status !== 200 || !response.data) {
        return { data: [], total_count: 0 };
      }

      const validators = Array.isArray(response.data.validators)
        ? (response.data.validators as Record<string, any>[])
        : [];

      const enriched = await Promise.all(
        validators.map(async (validator): Promise<Validator> => {
          const description = (validator.description ?? {}) as Record<string, any>;
          const identity = description.identity as string | undefined;
          const keybaseImageUrl = await this.keybaseService.getKeybaseAvatar(identity);

          return {
            operator_address: validator.operator_address,
            description,
            commission: validator.commission,
            status: validator.status,
            tokens: validator.tokens,
            delegator_shares: validator.delegator_shares,
            jailed: validator.jailed ?? false,
            consensus_pubkey: validator.consensus_pubkey,
            min_self_delegation: validator.min_self_delegation,
            keybase_image_url: keybaseImageUrl,
          };
        }),
      );

      return {
        data: enriched,
        total_count: enriched.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch validators: ${message}`);
      return { data: [], total_count: 0 };
    }
  }

  async getValidatorsCount(status = 'BOND_STATUS_BONDED'): Promise<number> {
    try {
      const response = await this.blockchainService.getFromApi<Record<string, any>>(
        '/cosmos/staking/v1beta1/validators',
        {
          params: {
            status,
            'pagination.limit': 1,
            'pagination.count_total': true,
          },
        },
      );

      if (response.status !== 200 || !response.data) {
        throw new Error(`Unexpected response: HTTP ${response.status}`);
      }

      const rawTotal =
        response.data.pagination?.total ??
        response.data.pagination?.total_count ??
        response.data.total ??
        response.data.total_count ??
        0;

      const total = Number(rawTotal);
      if (!Number.isFinite(total)) {
        throw new Error(`Invalid validator total received: ${rawTotal}`);
      }

      return total;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch validators count: ${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async getValidatorDetails(
    validatorAddress: string,
  ): Promise<ValidatorDetails | { error: string }> {
    try {
      const response = await this.blockchainService.getFromApi<Record<string, any>>(
        `/cosmos/staking/v1beta1/validators/${validatorAddress}`,
      );

      if (response.status === 200 && response.data) {
        const validatorData = response.data.validator ?? response.data;
        const description = (validatorData.description ?? {}) as Record<string, any>;
        const identity = description.identity as string | undefined;
        const keybaseImageUrl = await this.keybaseService.getKeybaseAvatar(identity);

        return {
          ...(validatorData as Record<string, unknown>),
          keybase_image_url: keybaseImageUrl,
        } as ValidatorDetails;
      }

      if (response.status === 404) {
        return { error: `Validator not found: ${response.status}` };
      }

      return { error: `Validator lookup failed: HTTP ${response.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch validator ${validatorAddress}: ${message}`);
      return { error: message };
    }
  }
}
