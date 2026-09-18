import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { PRIME_TRANSFER_MAX_CHUNKS } from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

import { isValidPrimeTransferChunkData } from './chunkedTransfer';
import { ETransferServerErrorCode } from './transferErrors';
import {
  assertLegacyTransferPacketSize,
  getTransferMessageLimit,
} from './transferSize';

import type {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

const RATE_LIMIT_INTERVAL_MS = 3500;
const CHUNK_REQUESTS_PER_SECOND = 512;
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
      maxMessageSize,
    }: {
      socket: Socket;
      roomId: string;
      isProxySide: boolean;
      maxMessageSize?: number;
    },
  ) {
    super(config);
    this.socket = socket;
    this.roomId = roomId;
    this.isProxySide = isProxySide;
    this.maxMessageSize = getTransferMessageLimit(maxMessageSize);
    this.setup();
  }

  socket: Socket;

  private readonly maxMessageSize: number;

  roomId: string;

  isProxySide: boolean;

  override sendAsString = false;

  private chunkWindowStartedAt = 0;

  private chunkRequestsInWindow = 0;

  private getRequestRejection({
    payload,
    eventName,
  }: {
    payload: IJsBridgeMessagePayload;
    eventName: string;
  }): ETransferServerErrorCode | 'drop' | undefined {
    const req: IJsonRpcRequest = payload.data as IJsonRpcRequest;

    if (req.method === 'sendTransferChunk') {
      const now = Date.now();
      if (now - this.chunkWindowStartedAt >= 1000) {
        this.chunkWindowStartedAt = now;
        this.chunkRequestsInWindow = 0;
      }
      // Count every attempt before inspecting data. Report throttling once per
      // window, then stop validating and replying to a sustained chunk flood.
      if (this.chunkRequestsInWindow > CHUNK_REQUESTS_PER_SECOND) return 'drop';
      this.chunkRequestsInWindow += 1;
      if (this.chunkRequestsInWindow > CHUNK_REQUESTS_PER_SECOND) {
        return ETransferServerErrorCode.RATE_LIMIT_EXCEEDED;
      }
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
        !isValidPrimeTransferChunkData(chunk.data)
      ) {
        return ETransferServerErrorCode.INVALID_PARAMETER;
      }
      return undefined;
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
      assertLegacyTransferPacketSize({
        roomId: this.roomId,
        payload,
        maxMessageSize: this.maxMessageSize,
      });
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
        const errorCode = this.getRequestRejection({
          payload: p,
          eventName: 'e2ee-c2c-request',
        });

        if (errorCode === 'drop') return;
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
