import { randomUUID } from 'node:crypto';

import axios from 'axios';

import { getHost } from '../config';
import { AppError, ERROR_CODES } from '../errors';

import type { IEndpointEnv } from '../config';
import type { Logger } from '../utils/logger';
import type { AxiosInstance } from 'axios';

const VERSION = '0.1.0';

export interface IOneKeyApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiClient {
  private env: IEndpointEnv;

  private logger?: Logger;

  constructor(env: IEndpointEnv = 'test') {
    this.env = env;
  }

  setEnv(env: IEndpointEnv): void {
    this.env = env;
  }

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  private createClient(service: string): AxiosInstance {
    const host = getHost(this.env);
    const baseURL = `https://${service}.${host}`;

    const client = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'X-Onekey-Request-ID': randomUUID(),
        'X-Onekey-Request-Platform': 'cli',
        'X-Onekey-Request-Version': VERSION,
        'X-Onekey-Request-Locale': 'en',
      },
    });

    client.interceptors.response.use(
      (response) => response,
      (error: {
        code?: string;
        message?: string;
        response?: { status: number; statusText: string };
      }) => {
        if (
          error.code === 'ECONNABORTED' ||
          error.message?.includes('timeout')
        ) {
          throw new AppError(
            ERROR_CODES.NET_RPC_TIMEOUT.code,
            'Request timed out',
            'Check network connectivity or try again',
          );
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new AppError(
            ERROR_CODES.NET_RPC_UNREACHABLE.code,
            `Cannot reach ${baseURL}`,
            'Check network connectivity',
          );
        }
        if (error.response) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            `HTTP ${error.response.status}: ${error.response.statusText}`,
            'Check request parameters',
            { details: { statusCode: error.response.status } },
          );
        }
        throw new AppError(
          ERROR_CODES.NET_REQUEST_FAILED.code,
          error.message ?? 'Network request failed',
          'Check network connectivity',
          { cause: error },
        );
      },
    );

    return client;
  }

  async get<T>(
    service: string,
    path: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const client = this.createClient(service);
    this.logger?.debug(
      `[API] GET ${service}${path}`,
      JSON.stringify(params ?? {}),
    );
    const response = await client.get<IOneKeyApiResponse<T>>(path, { params });
    return this.unwrap(response.data, `GET ${path}`);
  }

  async post<T>(service: string, path: string, body?: unknown): Promise<T> {
    const client = this.createClient(service);
    this.logger?.debug(
      `[API] POST ${service}${path}`,
      JSON.stringify(body ?? {}),
    );
    const response = await client.post<IOneKeyApiResponse<T>>(path, body);
    return this.unwrap(response.data, `POST ${path}`);
  }

  private unwrap<T>(response: IOneKeyApiResponse<T>, method: string): T {
    if (response.code === 0) {
      this.logger?.debug(`[API] ${method} success`);
      return response.data;
    }
    this.logger?.error(
      `[API] ${method} failed: code=${response.code} message=${response.message}`,
    );
    throw new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      `OneKey API error (code ${response.code}): ${response.message}`,
      'Check parameters or retry',
      {
        details: {
          upstreamCode: response.code,
          upstreamMessage: response.message,
        },
      },
    );
  }
}

export const apiClient = new ApiClient();
