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

// Upper bound on distinct methods tracked per connection. `method` comes from
// the remote peer, so without a cap a single peer could grow this map forever.
// Well above the number of methods a real peer calls.
const RATE_LIMIT_MAX_TRACKED_METHODS = 64;

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

  // Rate limit state held per bridge instance instead of a module-level map.
  // The old map was keyed by socket.id and never pruned, so every socket.io
  // reconnect (which mints a fresh id) leaked one entry per method for the
  // lifetime of the process. Dropping socket.id from the key keeps the map
  // bounded by method name and stable across reconnects, and the map is freed
  // with the instance. `method` is still peer-controlled, so the entry count is
  // additionally capped at RATE_LIMIT_MAX_TRACKED_METHODS, reclaiming expired
  // windows only (see pruneRateLimitState). We deliberately do NOT attach a
  // socket 'disconnect' listener to clear it (as the server does): the client
  // socket is long-lived and this bridge is re-created on it (e.g. QR refresh
  // -> joinRoom), where setup() detaches the superseded instance's c2c listener
  // so it can be GC'd - a disconnect listener would pin that old instance and
  // reintroduce a leak.
  private rateLimitState = new Map<string, number>();

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
    const req = payload?.data as IJsonRpcRequest | undefined;
    const method = typeof req?.method === 'string' ? req.method : '';

    // Check if method is in whitelist
    if (RATE_LIMIT_WHITELIST.has(method)) {
      return false;
    }

    // no socket id in the key: this map already belongs to this connection
    const rateLimitKey = `${eventName}:${method}`;

    const now = Date.now();
    const lastTime = this.rateLimitState.get(rateLimitKey);

    if (lastTime !== undefined && now - lastTime < RATE_LIMIT_INTERVAL_MS) {
      sendErrorResponse();
      return true;
    }

    if (
      lastTime === undefined &&
      this.rateLimitState.size >= RATE_LIMIT_MAX_TRACKED_METHODS
    ) {
      this.pruneRateLimitState(now);

      if (this.rateLimitState.size >= RATE_LIMIT_MAX_TRACKED_METHODS) {
        // Every tracked window is still live, so this peer is flooding distinct
        // method names. Refuse to track a new one and treat it as limited: the
        // flood throttles itself and the existing windows - the expensive calls
        // it is trying to reset - stay intact.
        sendErrorResponse();
        return true;
      }
    }

    this.rateLimitState.set(rateLimitKey, now);
    return false;
  }

  /**
   * Reclaim entries whose window has already passed - they cannot rate limit
   * anything any more.
   *
   * This only ever drops expired entries. Live windows are never touched: since
   * `method` is peer-controlled, wiping the map on a flood would let the
   * flooder reset the windows of the calls it was just blocked on, turning the
   * bound into a rate-limit bypass.
   */
  private pruneRateLimitState(now: number): void {
    Array.from(this.rateLimitState.entries()).forEach(([key, time]) => {
      if (now - time >= RATE_LIMIT_INTERVAL_MS) {
        this.rateLimitState.delete(key);
      }
    });
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
