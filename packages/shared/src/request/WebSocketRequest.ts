import { generateUUID } from '@onekeyhq/kit/src/utils/helper';
import {
  JsonPRCResponseError,
  ResponseError,
} from '@onekeyhq/shared/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

const socketsMap = new Map<string, WebSocket>();
const callbackMap = new Map<
  string,
  [(value: any) => void, (reason?: any) => void, ReturnType<typeof setTimeout>]
>();

interface IJsonRpcResponse {
  error?: {
    code: number;
    message: string;
  };
  result?: unknown;
  id: string;
}

export class WebSocketRequest {
  readonly url: string;

  readonly timeout: number;

  readonly expiredTimeout: number;

  private expiredTimerId!: NodeJS.Timeout;

  constructor(url: string, timeout = 20 * 1000, expiredTimeout = 60 * 1000) {
    this.url = url;
    this.timeout = timeout;
    this.expiredTimeout = expiredTimeout;
    this.establishConnection();
  }

  private waitForSocketConnection(
    socket: WebSocket,
    resolveCallback: () => void,
    rejectCallback: () => void,
    times = 0,
  ) {
    // max times for waiting times.
    if (times > 300) {
      rejectCallback();
      return;
    }
    setTimeout(() => {
      if (socket.readyState === 1) {
        resolveCallback();
      } else if (socket.readyState > 1) {
        rejectCallback();
      } else {
        this.waitForSocketConnection(
          socket,
          resolveCallback,
          rejectCallback,
          times + 1,
        );
      }
    }, 10); // wait 10 milisecond for the connection...
  }

  private readySocketConnection(socket: WebSocket): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      this.waitForSocketConnection(
        socket,
        () => {
          resolve(socket);
        },
        () => {
          reject(new Error('WebSocket connection timeout.'));
        },
      );
    });
  }

  private establishConnection(): Promise<WebSocket> {
    const socket = socketsMap.get(this.url);
    if (socket && socket.readyState < 2) {
      if (socket.readyState === 1) {
        return Promise.resolve(socket);
      }
      return this.readySocketConnection(socket);
    }
    let wsURL = this.url;
    // this code snippet won't be present in the production environment.
    if (process.env.NODE_ENV === 'development') {
      // Proxy by Webpack Dev Server
      // packages/web/webpack.config.js 37L
      if (
        platformEnv.isDev &&
        platformEnv.isWeb &&
        typeof document !== 'undefined'
      ) {
        // Proxy by Webpack Dev Server
        const url = new URL(this.url);
        url.host = window.location.host;
        url.protocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:';
        wsURL = url.href;
      }
    }
    const newSocket = new WebSocket(wsURL);
    socketsMap.set(this.url, newSocket);
    return new Promise((resolve, reject) => {
      newSocket.onopen = () => {
        this.waitForSocketConnection(
          newSocket,
          () => {
            resolve(newSocket);
          },
          () => {
            reject(new Error('WebSocket connection timeout.'));
          },
        );
      };

      newSocket.onmessage = async (message) => {
        await this.refreshConnectionStatus();
        const { id, result, error } = this.parseRPCResponse(message.data);
        const callback = callbackMap.get(id);
        if (callback) {
          const [callbackResolve, callbackReject, timerId] = callback;
          clearTimeout(timerId);
          if (error) {
            const errorMesseage = `Error JSON PRC response ${error.code}: ${error.message}`;
            debugLogger.websocket.error(errorMesseage);
            callbackReject(new JsonPRCResponseError(errorMesseage));
          } else {
            callbackResolve(result);
          }
        }
        callbackMap.delete(id);
      };
      newSocket.onerror = (error: unknown) => {
        reject(error);
        console.error(error);
      };
    });
  }

  private closeConnection() {
    const socket = socketsMap.get(this.url);
    if (socket) {
      socket.close();
      socketsMap.delete(this.url);
    }
  }

  parseRPCResponse(message: string): IJsonRpcResponse {
    let response: IJsonRpcResponse;
    try {
      response = JSON.parse(message) as IJsonRpcResponse;
    } catch {
      throw new ResponseError(
        `Invalid JSON RPC response, result not found: ${message}`,
      );
    }
    return response;
  }

  async refreshConnectionStatus(): Promise<WebSocket> {
    const socket = await this.establishConnection();
    clearTimeout(this.expiredTimerId);
    this.expiredTimerId = setTimeout(() => {
      this.closeConnection();
    }, this.expiredTimeout);
    return socket;
  }

  async call<T>(
    method: string,
    params?: JsonRpcParams,
    timeout?: number,
  ): Promise<T> {
    const socket = await this.refreshConnectionStatus();
    return new Promise((resolve, reject) => {
      const id = generateUUID();
      const timerId = setTimeout(() => {
        callbackMap.delete(id);
        reject(new Error('Timeout Error'));
      }, timeout || this.timeout);
      callbackMap.set(id, [resolve, reject, timerId]);
      const requestParams = normalizePayload(method, params, id);
      if (socket) {
        socket.send(`${JSON.stringify(requestParams)}\n`);
      }
    });
  }
}
