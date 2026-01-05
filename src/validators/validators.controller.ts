import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ValidatorDetails, ValidatorsResponse } from '../dto/schema.dto';
import { ValidatorsService } from './validators.service';
import { ValidatorsQueryDto } from './dto/validators-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Validators')
@ApiBearerAuth('api-key')
@Controller('api/v2')
export class ValidatorsController {
  constructor(private readonly validatorsService: ValidatorsService) {}

  @Get('validators')
  @UseGuards(ApiKeyGuard)
  async getValidators(@Query() query: ValidatorsQueryDto): Promise<ValidatorsResponse> {
    return this.validatorsService.getValidators(query);
  }

  @Get('validator/details/:validatorAddress')
  @UseGuards(ApiKeyGuard)
  async getValidatorDetails(
    @Param('validatorAddress') validatorAddress: string,
  ): Promise<ValidatorDetails> {
    const result = await this.validatorsService.getValidatorDetails(validatorAddress);

    if ('error' in result) {
      throw new HttpException(result.error, HttpStatus.NOT_FOUND);
    }

    return result;
  }
}
