import axios from 'axios';
import timeoutSignal from 'timeout-signal';

import type { IJsonRpcResponsePro } from '@onekeyhq/shared/types/request';

import {
  AxiosResponseError,
  JsonRPCResponseError,
  ResponseError,
} from '../errors';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

type IJsonRpcParams = undefined | { [p: string]: any } | Array<any>;

function normalizePayload(
  method: string,
  params: IJsonRpcParams,
  id = 0,
): IJsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
}

class JsonRPCRequest {
  readonly url: string;

  readonly timeout: number;

  readonly headers: Record<string, string>;

  constructor(url: string, headers?: Record<string, string>, timeout = 30_000) {
    this.url = url;
    this.timeout = timeout;

    this.headers = {
      'Content-Type': 'application/json',
    };
    if (headers) {
      Object.assign(this.headers, headers);
    }
  }

  private static parseRPCResponse<T>(
    response: IJsonRpcResponsePro<T>,
  ): Promise<T> {
    if (typeof response !== 'object') {
      throw new ResponseError(
        'Invalid JSON RPC response, typeof response should be an object',
        response,
      );
    } else if (response.error) {
      let message = 'Error JSON RPC response';
      const error = response.error as { message?: string };
      if (error?.message && typeof error?.message === 'string') {
        message = `Error JSON RPC response: ${error?.message}`;
      }
      throw new JsonRPCResponseError(message, response);
    } else if (!('result' in response)) {
      throw new ResponseError(
        'Invalid JSON RPC response, result not found',
        response,
      );
    }

    return Promise.resolve(response.result as T);
  }

  async call<T>(
    method: string,
    params?: IJsonRpcParams,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<T> {
    const signal = timeoutSignal(timeout || this.timeout) as any;
    try {
      const response = await axios({
        url: this.url,
        method: 'POST',
        headers: this.assembleHeaders(headers),
        data: JSON.stringify(normalizePayload(method, params)),
        signal,
      });
      return await JsonRPCRequest.parseRPCResponse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AxiosResponseError(
          `Wrong response<${error.response?.status ?? ''}>`,
          error.response,
        );
      }
      throw error;
    }
  }

  async batchCall<T>(
    calls: Array<[string, IJsonRpcParams]>,
    headers?: { [p: string]: string },
    timeout?: number,
    ignoreSoloError = true,
    autoFallbackToRpcSingle = true,
  ): Promise<T> {
    let jsonResponses: unknown[] = [];

    const useRpcBatch = !autoFallbackToRpcSingle;

    if (useRpcBatch) {
      const payload = calls.map(([method, params], index) =>
        normalizePayload(method, params, index),
      );
      try {
        const response = await axios({
          url: this.url,
          method: 'POST',
          headers: this.assembleHeaders(headers),
          data: JSON.stringify(payload),
          signal: timeoutSignal(timeout || this.timeout) as any,
        });

        jsonResponses = response.data;

        if (!Array.isArray(jsonResponses)) {
          throw new AxiosResponseError(
            'Invalid JSON Batch RPC response, response should be an array',
            response,
          );
        } else if (calls.length !== jsonResponses.length) {
          throw new AxiosResponseError(
            `Invalid JSON Batch RPC response, batch with ${calls.length} calls, but got ${jsonResponses.length} responses`,
            response,
          );
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new AxiosResponseError(
            `Wrong response<${error.response?.status ?? ''}>`,
            error.response,
          );
        }
        throw error;
      }
    } else {
      jsonResponses = await Promise.all(
        calls.map(async (c) => {
          try {
            const res = await this.call(c[0], c[1], headers, timeout);
            return {
              result: res,
            };
          } catch (error) {
            // pass
          }
        }),
      );
    }

    // @ts-ignore
    return Promise.all(
      jsonResponses
        // @ts-ignore
        .sort(({ id: idA }, { id: idB }) => idA - idB)
        // @ts-ignore
        .map((resp) =>
          // @ts-ignore
          JsonRPCRequest.parseRPCResponse(resp).catch((e) => {
            if (e instanceof JsonRPCResponseError && ignoreSoloError) {
              return undefined;
            }
            throw e;
          }),
        ),
    );
  }

  private assembleHeaders(
    headers: Record<string, string> = {},
  ): Record<string, string> {
    return { ...this.headers, ...headers };
  }
}

export { JsonRPCRequest };
