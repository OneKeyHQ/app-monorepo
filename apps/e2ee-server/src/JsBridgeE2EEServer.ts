/* eslint-disable no-restricted-syntax */
import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

import type {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

const RATE_LIMIT_INTERVAL_MS = 3000;
const lastRequestTime: Map<string, number> = new Map();

const CLIENT_TO_CLIENT_RATE_LIMIT_ERROR_CODE = -387_155_488;

// Rate limiting whitelist - methods that are exempt from rate limiting
const RATE_LIMIT_WHITELIST = new Set([
  'changeTransferDirection',
  'getRoomUsers',
  'leaveRoom',
  'cancelTransfer',
]);

export class JsBridgeE2EEServer extends JsBridgeBase {
  constructor(
    config: IJsBridgeConfig,
    { socketClient }: { socketClient: Socket },
  ) {
    super(config);
    this.socketClient = socketClient;
    this.setup();
  }

  private socketClient: Socket;

  override sendAsString = false;

  sendPayload(payload: IJsBridgeMessagePayload | string): void {
    const p = payload as IJsBridgeMessagePayload;
    const e = p?.error as { message: string; code: number } | undefined;
    if (e && e?.code && e?.code === CLIENT_TO_CLIENT_RATE_LIMIT_ERROR_CODE) {
      this.socketClient.emit('e2ee-c2c-response', payload);
      return;
    }
    this.socketClient.emit('e2ee-response', payload);
  }

  checkIsRateLimited({
    payload,
    eventName,
    sendErrorResponse,
  }: {
    payload: IJsBridgeMessagePayload;
    eventName: string;
    sendErrorResponse: () => void;
  }) {
    // Rate limiting check
    const req: IJsonRpcRequest = payload.data as IJsonRpcRequest;

    // Check if method is in whitelist
    if (RATE_LIMIT_WHITELIST.has(req.method)) {
      return false;
    }

    const rateLimitKey = `${this.socketClient.id}:${eventName}:${req.method}`;

    const now = Date.now();
    const lastTime = lastRequestTime.get(rateLimitKey) || 0;

    if (now - lastTime < RATE_LIMIT_INTERVAL_MS) {
      sendErrorResponse();
      return true;
    }

    lastRequestTime.set(rateLimitKey, now);
    return false;
  }

  setup() {
    this.socketClient.on('e2ee-request', async (payload) => {
      const p = payload as IJsBridgeMessagePayload;
      const isRateLimited = this.checkIsRateLimited({
        payload: p,
        eventName: 'e2ee-request',
        sendErrorResponse: () => {
          this.responseError({
            id: p.id || -9999,
            error: new Error(`Rate limit, please try again later`),
            scope: p.scope,
            remoteId: p.remoteId,
            peerOrigin: p.peerOrigin,
          });
        },
      });

      if (isRateLimited) {
        return;
      }

      this.receive(p, {
        origin: 'e2ee-server',
        internal: true,
      });
    });

    this.socketClient.on('e2ee-c2c-request', async ({ payload, roomId }) => {
      const p = payload as IJsBridgeMessagePayload;

      const isRateLimited = this.checkIsRateLimited({
        payload: p,
        eventName: 'e2ee-c2c-request',
        sendErrorResponse: () => {
          this.responseError({
            id: p.id || -9999,
            error: {
              message: `Rate limit,2222 please try again later`,
              code: CLIENT_TO_CLIENT_RATE_LIMIT_ERROR_CODE,
            },
            scope: p.scope,
            remoteId: p.remoteId,
            peerOrigin: p.peerOrigin,
          });
        },
      });

      if (isRateLimited) {
        return;
      }

      this.socketClient.to(roomId).emit('e2ee-c2c-request', p);
    });

    this.socketClient.on('e2ee-c2c-response', async ({ payload, roomId }) => {
      const p = payload as IJsBridgeMessagePayload;
      this.socketClient.to(roomId).emit('e2ee-c2c-response', p);
    });
  }
}
