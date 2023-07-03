import { generateUUID } from '@onekeyhq/kit/src/utils/helper';
import {
  JsonPRCResponseError,
  ResponseError,
} from '@onekeyhq/shared/src/errors/request-errors';
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

const callbackMap = new Map<string, (result: any) => void>();

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

  constructor(url: string, timeout = 30000, expiredTimeout = 60 * 1000) {
    this.url = url;
    this.timeout = timeout;
    this.expiredTimeout = expiredTimeout;
    this.establishConnection();
  }

  private waitForSocketConnection(socket: WebSocket, callback: () => void) {
    setTimeout(() => {
      if (socket.readyState === 1 && callback) {
        callback();
      } else {
        this.waitForSocketConnection(socket, callback);
      }
    }, 5); // wait 5 milisecond for the connection...
  }

  private readySocketConnection(socket: WebSocket): Promise<WebSocket> {
    return new Promise((resolve) => {
      this.waitForSocketConnection(socket, () => {
        resolve(socket);
      });
    });
  }

  private establishConnection(): Promise<WebSocket> {
    const socket = socketsMap.get(this.url);
    if (socket) {
      if (socket.readyState === 1) {
        return Promise.resolve(socket);
      }
      return this.readySocketConnection(socket);
    }
    let wsURL = this.url;
    // this code snippet won't be present in the production environment.
    if (process.env.NODE_ENV === 'development') {
      // Proxy by Webpack 
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
    return new Promise((resolve) => {
      newSocket.onopen = () => {
        this.waitForSocketConnection(newSocket, () => {
          resolve(newSocket);
        });
      };

      newSocket.onmessage = (message) => {
        const { id, result } = this.parseRPCResponse(message.data) as {
          id: string;
          result: any;
        };
        callbackMap.get(id)?.(result);
        callbackMap.delete(id);
      };
      newSocket.onerror = (error: unknown) => {
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
    if (response.error) {
      throw new JsonPRCResponseError(
        `Error JSON PRC response ${response.error.code}: ${response.error.message}`,
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
    return new Promise((resolve) => {
      const id = generateUUID();
      callbackMap.set(id, resolve);
      const requestParams = normalizePayload(method, params, id);
      if (socket) {
        socket.send(`${JSON.stringify(requestParams)}\n`);
      }
    });
  }
}
