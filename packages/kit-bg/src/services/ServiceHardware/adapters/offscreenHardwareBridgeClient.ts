import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import offscreenApiProxy from '../../../offscreens/instance/offscreenApiProxy';
import { onOffscreenEvent } from '../../../offscreens/offscreenEventBus';

import type {
  ConnectorDevice,
  ConnectorEventType,
  ConnectorSession,
  IHardwareBridge,
  UiResponseEvent,
  VendorType,
} from '@onekeyfe/hwk-adapter-core';

/**
 * SW-side `IHardwareBridge` — forwards to the offscreen-doc server
 * (`OffscreenApiThirdPartyHardware`) via `offscreenApiProxy`. Event
 * subscription is lazy: first `.on` attaches, last `.off` tears down,
 * so recreating adapters within an SW lifetime doesn't leak a listener.
 * Singleton across SW lifetime (SW kill → module dropped → SW restart
 * recreates on demand).
 */
class OffscreenHardwareBridgeClient implements IHardwareBridge {
  private eventHandlersByVendor = new Map<
    VendorType,
    Set<(event: { type: ConnectorEventType; data: unknown }) => void>
  >();

  /** Cached unsubscribe fn returned by `onOffscreenEvent`. */
  private unsubscribeFromBus: (() => void) | null = null;

  /** Cached unsubscribe fn for the offscreen-side SDK event bus. */
  private unsubscribeFromHwkSdkEvent: (() => void) | null = null;

  // -------------------------------------------------------------------------
  // Forwarded methods
  // -------------------------------------------------------------------------

  searchDevices(params: { vendor: VendorType }): Promise<ConnectorDevice[]> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] searchDevices vendor=${params.vendor}`,
    );
    return offscreenApiProxy.thirdPartyHardware.searchDevices(params);
  }

  connect(params: {
    vendor: VendorType;
    deviceId?: string;
  }): Promise<ConnectorSession> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] connect vendor=${params.vendor} deviceId=${
        params.deviceId ?? ''
      }`,
    );
    return offscreenApiProxy.thirdPartyHardware.connect(params);
  }

  disconnect(params: { vendor: VendorType; sessionId: string }): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] disconnect vendor=${params.vendor} sessionId=${params.sessionId}`,
    );
    return offscreenApiProxy.thirdPartyHardware.disconnect(params);
  }

  call(params: {
    vendor: VendorType;
    sessionId: string;
    method: string;
    callParams: unknown;
  }): Promise<unknown> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] call vendor=${params.vendor} method=${params.method}`,
    );
    return offscreenApiProxy.thirdPartyHardware.call(params);
  }

  cancel(params: { vendor: VendorType; sessionId: string }): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] cancel vendor=${params.vendor} sessionId=${params.sessionId}`,
    );
    return offscreenApiProxy.thirdPartyHardware.cancel(params);
  }

  uiResponse(params: { vendor: VendorType; response: UiResponseEvent }): void {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] uiResponse vendor=${params.vendor} type=${
        (params.response as { type?: string })?.type ?? 'unknown'
      }`,
    );
    // Fire-and-forget from caller's perspective. The proxy returns a Promise
    // we deliberately discard — `IHardwareBridge.uiResponse` is sync `void`.
    void offscreenApiProxy.thirdPartyHardware.uiResponse(params);
  }

  reset(params: { vendor: VendorType }): void {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] reset vendor=${params.vendor}`,
    );
    void offscreenApiProxy.thirdPartyHardware.reset(params);
  }

  // -------------------------------------------------------------------------
  // Event delivery (offscreen → SW)
  // -------------------------------------------------------------------------

  onEvent(
    params: { vendor: VendorType },
    handler: (event: { type: ConnectorEventType; data: unknown }) => void,
  ): void {
    this.ensureSubscribed();
    let set = this.eventHandlersByVendor.get(params.vendor);
    if (!set) {
      set = new Set();
      this.eventHandlersByVendor.set(params.vendor, set);
    }
    set.add(handler);
  }

  offEvent(
    params: { vendor: VendorType },
    handler: (event: { type: ConnectorEventType; data: unknown }) => void,
  ): void {
    const set = this.eventHandlersByVendor.get(params.vendor);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.eventHandlersByVendor.delete(params.vendor);
    }
    this.teardownIfIdle();
  }

  /**
   * Drop every handler for a vendor in one go. Useful when a vendor's
   * adapter is being torn down (e.g. switching transports) and the caller
   * doesn't have individual handler references around.
   */
  resetVendor(vendor: VendorType): void {
    this.eventHandlersByVendor.delete(vendor);
    this.teardownIfIdle();
  }

  /**
   * Full teardown — clear all handlers and unsubscribe from the bus.
   * Intended for SW shutdown / test cleanup. After calling this, the next
   * `onEvent` call re-establishes the subscription.
   */
  teardown(): void {
    this.eventHandlersByVendor.clear();
    this.unsubscribeFromBus?.();
    this.unsubscribeFromBus = null;
    this.unsubscribeFromHwkSdkEvent?.();
    this.unsubscribeFromHwkSdkEvent = null;
  }

  private ensureSubscribed(): void {
    if (this.unsubscribeFromBus) return;
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Bridge] subscribe to offscreen connector events',
    );
    if (!this.unsubscribeFromHwkSdkEvent) {
      this.unsubscribeFromHwkSdkEvent = onOffscreenEvent(
        'hwkSdkEvent',
        (event) => {
          if (event.type === 'log') {
            defaultLogger.hardware.sdkLog.log(`[hwk] ${event.message}`);
          }
        },
      );
    }
    this.unsubscribeFromBus = onOffscreenEvent(
      'thirdPartyHardwareConnectorEvent',
      (payload) => {
        const handlers = this.eventHandlersByVendor.get(
          payload.vendor as VendorType,
        );
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW][Bridge] connector event vendor=${payload.vendor} type=${
            payload.type
          } handlers=${handlers?.size ?? 0}`,
        );
        if (!handlers || handlers.size === 0) return;
        const event = { type: payload.type, data: payload.data };
        for (const handler of handlers) {
          try {
            handler(event);
          } catch (error) {
            defaultLogger.hardware.sdkLog.log(
              `[3rdPartyHW][Bridge] handler threw: ${
                (error as Error)?.message ?? String(error)
              }`,
            );
          }
        }
      },
    );
  }

  private teardownIfIdle(): void {
    if (this.eventHandlersByVendor.size > 0) return;
    this.unsubscribeFromBus?.();
    this.unsubscribeFromBus = null;
    this.unsubscribeFromHwkSdkEvent?.();
    this.unsubscribeFromHwkSdkEvent = null;
  }
}

let singleton: OffscreenHardwareBridgeClient | null = null;

/**
 * Returns the caller-side `IHardwareBridge` singleton. Safe to call
 * multiple times within one SW lifetime; the subscription to
 * `offscreenEventBus` is established lazily when the first handler
 * registers and torn down when the last one unregisters.
 */
export function getOffscreenHardwareBridgeClient(): IHardwareBridge {
  if (!singleton) singleton = new OffscreenHardwareBridgeClient();
  return singleton;
}
