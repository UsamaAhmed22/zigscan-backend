import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import * as https from 'https';
import { AppConfiguration } from '../config/configuration';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly apiClient: AxiosInstance;
  private readonly rpcClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.getOrThrow<AppConfiguration['blockchain']>('blockchain');

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    this.apiClient = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30_000,
      httpsAgent,
      validateStatus: () => true,
    });

    this.rpcClient = axios.create({
      baseURL: config.rpcBaseUrl,
      timeout: 30_000,
      httpsAgent,
      validateStatus: () => true,
    });
  }

  async getFromApi<T = unknown>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.logger.debug(`GET API ${path}`);
    return this.apiClient.get<T>(path, config);
  }

  async requestToApi<T = unknown>(
    method: Method,
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.logger.debug(`${method.toUpperCase()} API ${path}`);
    return this.apiClient.request<T>({
      method,
      url: path,
      data,
      ...config,
    });
  }

  async getFromRpc<T = unknown>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.logger.debug(`GET RPC ${path}`);
    return this.rpcClient.get<T>(path, config);
  }
}
