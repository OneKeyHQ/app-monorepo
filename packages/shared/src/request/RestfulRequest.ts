import { Buffer } from 'buffer';

import fetch from 'cross-fetch';
import timeoutSignal from 'timeout-signal';

import { ResponseError } from '@onekeyhq/shared/src/errors/request-errors';

import type { Response } from 'cross-fetch';

class RestfulRequest {
  readonly baseUrl: string;

  readonly timeout: number;

  readonly headers: Record<string, string>;

  constructor(
    baseUrl: string,
    headers?: Record<string, string>,
    timeout = 30000,
  ) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.timeout = timeout;

    this.headers = {};
    if (headers) {
      Object.assign(this.headers, headers);
    }
  }

  static handleResponse(response: Response): Promise<Response> {
    if (!response.ok) {
      throw new ResponseError(`Wrong response<${response.status}>`, response);
    }

    return Promise.resolve(response);
  }

  createAbortSignal({ timeout }: { timeout?: number }) {
    const signal = timeoutSignal(timeout || this.timeout);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return signal as any;
  }

  async get(
    path: string,
    params?: Record<string, any>,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<Response> {
    // eslint-disable-next-line no-param-reassign
    headers = this.assembleHeaders(headers);

    const url = this.buildUrl(path);
    if (typeof params === 'object') {
      url.search = new URLSearchParams(params).toString();
    }

    const response = await fetch(url.toString(), {
      headers,
      signal: this.createAbortSignal({ timeout }),
    });

    return RestfulRequest.handleResponse(response);
  }

  async post(
    path: string,
    data?: Record<string, any> | string,
    json = false,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<Response> {
    // eslint-disable-next-line no-param-reassign
    headers = this.assembleHeaders(headers);
    if (json) {
      headers['Content-Type'] = 'application/json';
    }

    const url = this.buildUrl(path);
    const body =
      // eslint-disable-next-line no-nested-ternary
      headers['Content-Type'] === 'application/x-binary'
        ? Buffer.from(data as string, 'hex')
        : // eslint-disable-next-line no-nested-ternary
        typeof data === 'object'
        ? json
          ? JSON.stringify(data)
          : new URLSearchParams(data).toString()
        : data;

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body,
      signal: this.createAbortSignal({ timeout }),
    });

    return RestfulRequest.handleResponse(response);
  }

  private buildUrl(path: string): URL {
    // eslint-disable-next-line no-param-reassign
    path = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}${path}`;
    return new URL(url);
  }

  private assembleHeaders(
    headers?: Record<string, string>,
  ): Record<string, string> {
    // eslint-disable-next-line no-param-reassign
    headers = headers || {};
    return { ...this.headers, ...headers };
  }
}

export { RestfulRequest };
