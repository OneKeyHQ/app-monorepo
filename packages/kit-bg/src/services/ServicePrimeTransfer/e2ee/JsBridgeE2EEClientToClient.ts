import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

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

    const rateLimitKey = `${this.socket.id}:${eventName}:${req.method}`;

    const now = Date.now();
    const lastTime = lastRequestTime.get(rateLimitKey) || 0;

    if (now - lastTime < RATE_LIMIT_INTERVAL_MS) {
      sendErrorResponse();
      return true;
    }

    lastRequestTime.set(rateLimitKey, now);
    return false;
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
        console.log(eventName, p);
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
        console.log('e2ee-c2c-request', p);
        const isRateLimited = this.checkIsRateLimited({
          payload: p,
          eventName: 'e2ee-c2c-request',
          sendErrorResponse: () => {
            this.responseError({
              id: p.id || -9999,
              error: {
                message: appLocale.intl.formatMessage({
                  id: ETranslations.global_request_limit,
                }),
                // code: CLIENT_TO_CLIENT_RATE_LIMIT_ERROR_CODE,
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

        this.receive(p, {
          origin: 'e2ee-c2c-2',
          internal: true,
        });
      });
    }
  }
}
