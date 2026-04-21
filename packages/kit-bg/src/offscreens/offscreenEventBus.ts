/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IBackgroundApiInternalCallMessage } from '../apis/IBackgroundApi';
import type { ConnectorEventType } from '@onekeyfe/hwk-adapter-core';

/**
 * Typed one-way push channel from the offscreen document to the Service Worker.
 *
 * Wraps the existing `appGlobals.extJsBridgeOffscreenToBg` plumbing so:
 * - Offscreen callers get a typed `emit()` API.
 * - SW subscribers get a typed `on()` API.
 * - The underlying "send an INTERNAL_ prefixed @backgroundMethod through the
 *   RPC bridge" trick is hidden behind this module.
 *
 * This is NOT a general-purpose event bus. It is intentionally narrow:
 * - Only offscreen → SW direction. (SW → offscreen uses `offscreenApiProxy`.)
 * - All events land on a single `@backgroundMethod` on `ServiceHardware`
 *   (see `OFFSCREEN_EVENT_TARGET_SERVICE` + `OFFSCREEN_EVENT_DISPATCH_METHOD`).
 *   Events for other services would require either a separate bus or a
 *   `service` parameter — out of scope today.
 *
 * The legacy hardwareSDKLowLevel event path in `offscreenApi.ts:22-38` is
 * left untouched — that's OneKey's own hardware SDK's event pipe, semantically
 * identical to this but scoped to the in-house SDK. We don't consolidate them
 * to avoid touching OneKey's own SDK integration.
 */

export interface IOffscreenEventMap {
  /**
   * Unified connector event for third-party hardware running in offscreen.
   *
   * Shape matches `IHardwareBridge.onEvent` in `@onekeyfe/hwk-adapter-core`
   * so the SW-side bridge can transparently forward events to whoever called
   * `bridge.onEvent(...)` (typically `createBridgedConnector` subscribers).
   *
   * `data` is intentionally `unknown` — its concrete shape depends on `type`
   * and is defined by `ConnectorEventMap` in the SDK. Consumers that know
   * the event type should narrow at use site.
   */
  thirdPartyHardwareConnectorEvent: {
    vendor: string;
    type: ConnectorEventType;
    data: unknown;
  };
}

export type IOffscreenEventType = keyof IOffscreenEventMap;

/**
 * SW-side target. Receiver is a `@backgroundMethod` on `ServiceHardware`
 * with this name (prefixed with `INTERNAL_` by the decorator).
 */
export const OFFSCREEN_EVENT_TARGET_SERVICE = 'serviceHardware' as const;
export const OFFSCREEN_EVENT_DISPATCH_METHOD =
  'passThirdPartyHardwareEventsFromOffscreenToBackground' as const;

// ---------------------------------------------------------------------------
// Offscreen side — emit
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget push from offscreen to SW. Must run in the offscreen
 * document runtime; becomes a no-op (with a warning) elsewhere.
 */
export function emitOffscreenEventToBackground<K extends IOffscreenEventType>(
  type: K,
  payload: IOffscreenEventMap[K],
): void {
  if (!platformEnv.isExtensionOffscreen) {
    // eslint-disable-next-line no-console
    console.warn(
      '[offscreenEventBus] emitOffscreenEventToBackground called outside offscreen — ignored',
      type,
    );
    return;
  }
  const bridge = appGlobals.extJsBridgeOffscreenToBg;
  if (!bridge) {
    // eslint-disable-next-line no-console
    console.warn(
      '[offscreenEventBus] extJsBridgeOffscreenToBg not initialized yet — event dropped',
      type,
    );
    return;
  }
  const message: IBackgroundApiInternalCallMessage = {
    service: OFFSCREEN_EVENT_TARGET_SERVICE,
    method: `${INTERNAL_METHOD_PREFIX}${OFFSCREEN_EVENT_DISPATCH_METHOD}`,
    params: [{ type, payload }],
  };
  try {
    void bridge.request({ data: message });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[offscreenEventBus] emit failed', type, error);
  }
}

// ---------------------------------------------------------------------------
// SW side — subscribe + dispatch
// ---------------------------------------------------------------------------

type IHandler<K extends IOffscreenEventType> = (
  payload: IOffscreenEventMap[K],
) => void;

const handlersByType: {
  [K in IOffscreenEventType]?: Set<IHandler<K>>;
} = {};

/**
 * Subscribe to a typed offscreen event in SW. Returns an unsubscribe fn.
 */
export function onOffscreenEvent<K extends IOffscreenEventType>(
  type: K,
  handler: IHandler<K>,
): () => void {
  let set = handlersByType[type];
  if (!set) {
    set = new Set<IHandler<K>>() as NonNullable<(typeof handlersByType)[K]>;
    handlersByType[type] = set;
  }
  set.add(handler);
  return () => {
    handlersByType[type]?.delete(handler);
  };
}

/**
 * Dispatch an event received by the SW bridge to every subscribed handler.
 * Only the ServiceHardware `@backgroundMethod` receiver should call this.
 */
export function dispatchOffscreenEvent<K extends IOffscreenEventType>(
  type: K,
  payload: IOffscreenEventMap[K],
): void {
  const set = handlersByType[type];
  if (!set || set.size === 0) return;
  for (const handler of set) {
    try {
      handler(payload);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[offscreenEventBus] handler threw', type, error);
    }
  }
}
