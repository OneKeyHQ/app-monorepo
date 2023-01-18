import fetch from 'cross-fetch';
import timeoutSignal from 'timeout-signal';

import type { IJsonRpcResponsePro } from '@onekeyhq/engine/src/types';
import {
  JsonPRCResponseError,
  ResponseError,
} from '@onekeyhq/shared/src/errors/request-errors';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

type JsonRpcParams = undefined | { [p: string]: any } | Array<any>;

function normalizePayload(
  method: string,
  params: JsonRpcParams,
  id = 0,
): IJsonRpcRequest {
  const payload: IJsonRpcRequest = {
    jsonrpc: '2.0',
    id,
    method,
  };

  if (typeof payload !== 'undefined') {
    payload.params = params;
  }

  return payload;
}

class JsonRPCRequest {
  readonly url: string;

  readonly timeout: number;

  readonly headers: Record<string, string>;

  constructor(url: string, headers?: Record<string, string>, timeout = 30000) {
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
      throw new JsonPRCResponseError('Error JSON PRC response', response);
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
    params?: JsonRpcParams,
    headers?: Record<string, string>,
    timeout?: number,
  ): Promise<T> {
    // eslint-disable-next-line no-param-reassign
    headers = this.assembleHeaders(headers);
    const payload = normalizePayload(method, params);

    const signal = timeoutSignal(timeout || this.timeout) as any;
    const response = await fetch(this.url, {
      headers,
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw new ResponseError(`Wrong response<${response.status}>`, response);
    }

    const jsonResponse: any = await response.json();
    return JsonRPCRequest.parseRPCResponse(jsonResponse);
  }

  async batchCall<T>(
    calls: Array<[string, JsonRpcParams]>,
    headers?: { [p: string]: string },
    timeout?: number,
    ignoreSoloError = true,
  ): Promise<T> {
    // eslint-disable-next-line no-param-reassign
    headers = this.assembleHeaders(headers);
    const payload = calls.map(([method, params], index) =>
      normalizePayload(method, params, index),
    );

    const response = await fetch(this.url, {
      headers,
      method: 'POST',
      body: JSON.stringify(payload),
      signal: timeoutSignal(timeout || this.timeout) as any,
    });

    if (!response.ok) {
      throw new ResponseError(`Wrong response<${response.status}>`, response);
    }

    const jsonResponses: any = await response.json();
    if (!Array.isArray(jsonResponses)) {
      throw new ResponseError(
        'Invalid JSON Batch RPC response, response should be an array',
        response,
      );
    } else if (calls.length !== jsonResponses.length) {
      throw new ResponseError(
        `Invalid JSON Batch RPC response, batch with ${calls.length} calls, but got ${jsonResponses.length} responses`,
        response,
      );
    }

    // @ts-ignore
    return Promise.all(
      jsonResponses
        .sort(({ id: idA }, { id: idB }) => idA - idB)
        .map((resp) =>
          JsonRPCRequest.parseRPCResponse(resp).catch((e) => {
            if (e instanceof JsonPRCResponseError && ignoreSoloError) {
              return undefined;
            }
            throw e;
          }),
        ),
    );
  }

  private assembleHeaders(
    headers?: Record<string, string>,
  ): Record<string, string> {
    // eslint-disable-next-line no-param-reassign
    headers = headers || {};
    return { ...this.headers, ...headers };
  }
}

export { JsonRPCRequest };
