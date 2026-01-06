import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MemesDotFunCoinsResponse } from '../dto/schema.dto';

@Injectable()
export class MdfService {
  private readonly logger = new Logger(MdfService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getCoins(page = 1, limit = 10): Promise<MemesDotFunCoinsResponse> {
    const apiBaseUrl = this.configService.get<string>('memesfun.apiBaseUrl');
    const apiKey = this.configService.get<string>('memesfun.apiKey');

    if (!apiBaseUrl || !apiKey) {
      this.logger.warn('Memes.fun API configuration is incomplete');
      throw new HttpException('Memes.fun API is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    const url = `${normalizedBaseUrl}/memesdotfun-coins`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<MemesDotFunCoinsResponse>(url, {
          params: { page, limit },
          headers: {
            'x-api-key': apiKey,
          },
          timeout: 20_000,
        }),
      );

      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const trace = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to fetch Memes.fun coins', trace);
      throw new HttpException(`Memes.fun API request failed: ${message}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
