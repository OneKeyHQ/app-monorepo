import offscreenApiProxy from '../../../offscreens/instance/offscreenApiProxy';
import { onOffscreenEvent } from '../../../offscreens/offscreenEventBus';

import type {
  ConnectorDevice,
  ConnectorEventType,
  ConnectorSession,
  IHardwareBridge,
  VendorType,
} from '@onekeyfe/hwk-adapter-core';

/**
 * Client for the Offscreen-side hardware bridge.
 *
 * Implements `IHardwareBridge` on the caller side (runs in the Service
 * Worker). The real server is `OffscreenApiThirdPartyHardware`, which lives in
 * the Offscreen Document and owns the per-vendor `IConnector` instances.
 *
 * - Methods (searchDevices / connect / call / ...) forward to
 *   `offscreenApiProxy.thirdPartyHardware.<method>(...)` via the existing
 *   RemoteApiProxy channel.
 * - `onEvent` / `offEvent` maintain a per-vendor handler set. The underlying
 *   `onOffscreenEvent` subscription is set up lazily on the first `onEvent`
 *   and torn down when the last handler is removed, so the bus doesn't hold
 *   a dead reference after all subscribers are gone.
 *
 * Pass this into `createBridgedConnector('ledger', client)` — the SDK
 * returns a full `IConnector` whose every method flows through here.
 *
 * Lifecycle notes:
 * - In the extension build the SW process itself is the outer lifecycle:
 *   when Chrome kills the SW, this module's singleton is dropped and a new
 *   SW instance recreates it on demand.
 * - Within a single SW lifetime, callers should `.off()` each handler they
 *   `.on()`'d — typically driven by the SDK adapter's dispose path. The
 *   internal subscription auto-unsubscribes once the last handler leaves,
 *   so swapping transports (e.g. Trezor USB ↔ BLE in a future release) or
 *   re-creating adapters doesn't leak a stale bus listener.
 */
class OffscreenHardwareBridgeClient implements IHardwareBridge {
  private eventHandlersByVendor = new Map<
    VendorType,
    Set<(event: { type: ConnectorEventType; data: unknown }) => void>
  >();

  /** Cached unsubscribe fn returned by `onOffscreenEvent`. */
  private unsubscribeFromBus: (() => void) | null = null;

  // -------------------------------------------------------------------------
  // Forwarded methods
  // -------------------------------------------------------------------------

  searchDevices(params: { vendor: VendorType }): Promise<ConnectorDevice[]> {
    return offscreenApiProxy.thirdPartyHardware.searchDevices(params);
  }

  connect(params: {
    vendor: VendorType;
    deviceId?: string;
  }): Promise<ConnectorSession> {
    return offscreenApiProxy.thirdPartyHardware.connect(params);
  }

  disconnect(params: {
    vendor: VendorType;
    sessionId: string;
  }): Promise<void> {
    return offscreenApiProxy.thirdPartyHardware.disconnect(params);
  }

  call(params: {
    vendor: VendorType;
    sessionId: string;
    method: string;
    callParams: unknown;
  }): Promise<unknown> {
    return offscreenApiProxy.thirdPartyHardware.call(params);
  }

  cancel(params: { vendor: VendorType; sessionId: string }): Promise<void> {
    return offscreenApiProxy.thirdPartyHardware.cancel(params);
  }

  uiResponse(params: {
    vendor: VendorType;
    response: { type: string; payload: unknown };
  }): void {
    // Fire-and-forget from caller's perspective. The proxy returns a Promise
    // we deliberately discard — `IHardwareBridge.uiResponse` is sync `void`.
    void offscreenApiProxy.thirdPartyHardware.uiResponse(params);
  }

  reset(params: { vendor: VendorType }): void {
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
  }

  private ensureSubscribed(): void {
    if (this.unsubscribeFromBus) return;
    this.unsubscribeFromBus = onOffscreenEvent(
      'thirdPartyHardwareConnectorEvent',
      (payload) => {
        const handlers = this.eventHandlersByVendor.get(
          payload.vendor as VendorType,
        );
        if (!handlers || handlers.size === 0) return;
        const event = { type: payload.type, data: payload.data };
        for (const handler of handlers) {
          try {
            handler(event);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              '[offscreenHardwareBridgeClient] connector event handler threw',
              error,
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
