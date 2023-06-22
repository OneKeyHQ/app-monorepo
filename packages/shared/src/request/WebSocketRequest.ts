import fetch from 'cross-fetch';
import timeoutSignal from 'timeout-signal';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { IJsonRpcResponsePro } from '@onekeyhq/engine/src/types';
import { generateUUID } from '@onekeyhq/kit/src/utils/helper';
import {
  JsonPRCResponseError,
  ResponseError,
} from '@onekeyhq/shared/src/errors/request-errors';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

type JsonRpcParams = undefined | { [p: string]: any } | Array<any>;

function normalizePayload(
  method: string,
  params: JsonRpcParams,
  id: string,
): IJsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
}

class WebSocketRequest {
  readonly url: string;

  readonly timeout: number;

  readonly socket: WebSocket;

  callbackMap = new Map<string, (result: any) => void>();

  //   readonly headers: Record<string, string>;

  constructor(url: string, timeout = 30000) {
    this.url = url;
    this.timeout = timeout;
    const protocol = document.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const wsuri = `${protocol}//${document.location.host}/nexa_ws`;
    this.socket = new WebSocket(wsuri);
    this.socket.onopen = () => {
      console.log(`WebSocket onopen: ${wsuri} connected`);
    };

    this.socket.onmessage = (message) => {
      console.log('WebSocket onmessage:', message.data);

      const { id, result } = JSON.parse(message.data) as {
        id: string;
        result: any;
      };
      this.callbackMap.get(id)?.(result);
      this.callbackMap.delete(id);
    };
    this.socket.onerror = (error) => {
      console.error(error);
    };
  }

  private async getIsRpcBatchDisabled(url: string): Promise<boolean> {
    const whitelistHosts =
      await simpleDb.setting.getRpcBatchFallbackWhitelistHosts();

    return !!whitelistHosts.find((n) => url.includes(n.url));
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
    timeout?: number,
  ): Promise<T> {
    // const signal = timeoutSignal(timeout || this.timeout) as any;
    // const response = await fetch(this.url, {
    //   headers: this.assembleHeaders(headers),
    //   method: 'POST',
    //   body: JSON.stringify(normalizePayload(method, params)),
    //   signal,
    // });

    // if (!response.ok) {
    //   throw new ResponseError(`Wrong response<${response.status}>`, response);
    // }

    // const jsonResponse: any = await response.json();
    // return JsonRPCRequest.parseRPCResponse(jsonResponse);
    return new Promise((resolve) => {
      const id = generateUUID();
      this.callbackMap.set(id, resolve);
      const requestParams = normalizePayload(method, params, id);
      this.socket.send(`${JSON.stringify(requestParams)}\n`);
    });
  }

  //   async batchCall<T>(
  //     calls: Array<[string, JsonRpcParams]>,
  //     headers?: { [p: string]: string },
  //     timeout?: number,
  //     ignoreSoloError = true,
  //     autoFallbackToRpcSingle = true,
  //   ): Promise<T> {
  //     let jsonResponses: unknown[] = [];

  //     const useRpcBatch =
  //       !autoFallbackToRpcSingle || !(await this.getIsRpcBatchDisabled(this.url));

  //     if (useRpcBatch) {
  //       const payload = calls.map(([method, params], index) =>
  //         normalizePayload(method, params, index),
  //       );
  //       const response = await fetch(this.url, {
  //         headers: this.assembleHeaders(headers),
  //         method: 'POST',
  //         body: JSON.stringify(payload),
  //         signal: timeoutSignal(timeout || this.timeout) as any,
  //       });
  //       if (!response.ok) {
  //         throw new ResponseError(`Wrong response<${response.status}>`, response);
  //       }

  //       jsonResponses = await response.json();

  //       if (!Array.isArray(jsonResponses)) {
  //         throw new ResponseError(
  //           'Invalid JSON Batch RPC response, response should be an array',
  //           response,
  //         );
  //       } else if (calls.length !== jsonResponses.length) {
  //         throw new ResponseError(
  //           `Invalid JSON Batch RPC response, batch with ${calls.length} calls, but got ${jsonResponses.length} responses`,
  //           response,
  //         );
  //       }
  //     } else {
  //       jsonResponses = await Promise.all(
  //         calls.map(async (c) => {
  //           try {
  //             const res = await this.call(c[0], c[1], headers, timeout);
  //             return {
  //               result: res,
  //             };
  //           } catch (error) {
  //             // pass
  //           }
  //         }),
  //       );
  //     }

  //     // @ts-ignore
  //     return Promise.all(
  //       jsonResponses
  //         // @ts-ignore
  //         .sort(({ id: idA }, { id: idB }) => idA - idB)
  //         // @ts-ignore
  //         .map((resp) =>
  //           // @ts-ignore
  //           JsonRPCRequest.parseRPCResponse(resp).catch((e) => {
  //             if (e instanceof JsonPRCResponseError && ignoreSoloError) {
  //               return undefined;
  //             }
  //             throw e;
  //           }),
  //         ),
  //     );
  //   }

  //   private assembleHeaders(
  //     headers: Record<string, string> = {},
  //   ): Record<string, string> {
  //     return { ...this.headers, ...headers };
  //   }
}

export { WebSocketRequest };
