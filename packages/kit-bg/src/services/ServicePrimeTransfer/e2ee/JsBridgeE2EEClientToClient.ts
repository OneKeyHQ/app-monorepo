import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  PRIME_TRANSFER_CHUNK_SIZE,
  PRIME_TRANSFER_MAX_CHUNKS,
} from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

import { ETransferServerErrorCode } from './transferErrors';

import type {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

const RATE_LIMIT_INTERVAL_MS = 3500;
const lastRequestTime: Map<string, number> = new Map();

// Rate limiting whitelist - methods that are exempt from rate limiting
const RATE_LIMIT_WHITELIST = new Set([
  'changeTransferDirection',
  'cancelTransfer',
]);

// TODO jsbridge promise id use uuid
export class JsBridgeE2EEClientToClient extends JsBridgeBase {
  constructor(
    config: IJsBridgeConfig,
    {
      socket,
      roomId,
      isProxySide,
    }: { socket: Socket; roomId: string; isProxySide: boolean },
  ) {
    super(config);
    this.socket = socket;
    this.roomId = roomId;
    this.isProxySide = isProxySide;
    this.setup();
  }

  socket: Socket;

  roomId: string;

  isProxySide: boolean;

  override sendAsString = false;

  private chunkWindowStartedAt = 0;

  private chunkRequestsInWindow = 0;

  private getRequestErrorCode({
    payload,
    eventName,
  }: {
    payload: IJsBridgeMessagePayload;
    eventName: string;
  }): ETransferServerErrorCode | undefined {
    const req: IJsonRpcRequest = payload.data as IJsonRpcRequest;

    if (req.method === 'sendTransferChunk') {
      const params = req?.params;
      const chunk = (Array.isArray(params) ? params[0] : undefined) as
        | { data?: unknown; transferId?: unknown; index?: unknown }
        | undefined;
      if (
        !Array.isArray(params) ||
        params.length !== 1 ||
        !chunk ||
        typeof chunk !== 'object' ||
        Array.isArray(chunk) ||
        Object.keys(chunk).length !== 3 ||
        typeof chunk.transferId !== 'string' ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(chunk.transferId) ||
        typeof chunk.index !== 'number' ||
        !Number.isSafeInteger(chunk.index) ||
        chunk.index < 0 ||
        chunk.index >= PRIME_TRANSFER_MAX_CHUNKS ||
        typeof chunk.data !== 'string' ||
        chunk.data.length === 0 ||
        chunk.data.length > PRIME_TRANSFER_CHUNK_SIZE ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(chunk.data)
      ) {
        return ETransferServerErrorCode.INVALID_PARAMETER;
      }
      const now = Date.now();
      if (now - this.chunkWindowStartedAt >= 1000) {
        this.chunkWindowStartedAt = now;
        this.chunkRequestsInWindow = 0;
      }
      this.chunkRequestsInWindow += 1;
      return this.chunkRequestsInWindow > 512
        ? ETransferServerErrorCode.RATE_LIMIT_EXCEEDED
        : undefined;
    }

    // Check if method is in whitelist
    if (RATE_LIMIT_WHITELIST.has(req.method)) {
      return undefined;
    }

    const rateLimitKey = `${this.socket.id}:${eventName}:${req.method}`;

    const now = Date.now();
    const lastTime = lastRequestTime.get(rateLimitKey) || 0;

    if (now - lastTime < RATE_LIMIT_INTERVAL_MS) {
      return ETransferServerErrorCode.RATE_LIMIT_EXCEEDED;
    }

    lastRequestTime.set(rateLimitKey, now);
    return undefined;
  }

  sendPayload(payload: IJsBridgeMessagePayload): void {
    if (this.isProxySide) {
      this.socket.emit('e2ee-c2c-request', {
        payload,
        roomId: this.roomId,
      });
    } else {
      this.socket.emit('e2ee-c2c-response', {
        payload,
        roomId: this.roomId,
      });
    }
  }

  setup() {
    if (this.isProxySide) {
      const eventName = 'e2ee-c2c-response';
      this.socket.listeners(eventName).forEach((listener) => {
        this.socket.off(eventName, listener);
      });
      this.socket.on(eventName, async (payload) => {
        const p = payload as IJsBridgeMessagePayload;
        this.receive(p, {
          origin: 'e2ee-c2c-1',
          internal: true,
        });
      });
    } else {
      const eventName = 'e2ee-c2c-request';
      this.socket.listeners(eventName).forEach((listener) => {
        this.socket.off(eventName, listener);
      });
      this.socket.on(eventName, async (payload) => {
        const p = payload as IJsBridgeMessagePayload;
        const errorCode = this.getRequestErrorCode({
          payload: p,
          eventName: 'e2ee-c2c-request',
        });

        if (errorCode !== undefined) {
          this.responseError({
            id: p.id ?? -9999,
            error: {
              code: errorCode,
              message:
                errorCode === ETransferServerErrorCode.INVALID_PARAMETER
                  ? 'Invalid transfer chunk'
                  : appLocale.intl.formatMessage({
                      id: ETranslations.global_request_limit,
                    }),
            },
            scope: p.scope,
            remoteId: p.remoteId,
            peerOrigin: p.peerOrigin,
          });
          return;
        }

        this.receive(p, {
          origin: 'e2ee-c2c-2',
          internal: true,
        });
      });
    }
  }
}
