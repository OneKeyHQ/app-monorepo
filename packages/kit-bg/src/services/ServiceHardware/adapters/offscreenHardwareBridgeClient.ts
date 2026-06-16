import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import offscreenApiProxy from '../../../offscreens/instance/offscreenApiProxy';
import { onOffscreenEvent } from '../../../offscreens/offscreenEventBus';

import type {
  ConnectorCallResult,
  ConnectorDevice,
  ConnectorEventType,
  ConnectorSession,
  IHardwareBridge,
  UiResponseEvent,
  VendorType,
} from '@onekeyfe/hwk-adapter-core';

type IConnectorSearchDevicesOptions = {
  waitForAll?: boolean;
};

/**
 * SW-side `IHardwareBridge` — forwards to the offscreen-doc server
 * (`OffscreenApiThirdPartyHardware`) via `offscreenApiProxy`. Event
 * subscription is lazy: first `.on` attaches, last `.off` tears down,
 * so recreating adapters within an SW lifetime doesn't leak a listener.
 * Singleton across SW lifetime (SW kill → module dropped → SW restart
 * recreates on demand).
 */
export class OffscreenHardwareBridgeClient implements IHardwareBridge {
  private eventHandlersByVendor = new Map<
    VendorType,
    Set<(event: { type: ConnectorEventType; data: unknown }) => void>
  >();

  private knownCredentialsByVendor = new Map<VendorType, unknown[]>();

  private replayCredentialsPromisesByVendor = new Map<
    VendorType,
    Promise<void>
  >();

  // Vendors whose credentials are already loaded into the (persistent) offscreen
  // connector for this SW lifetime. Avoids re-pushing on every forwarded call,
  // which would reset the connector's array (length=0; push) and could clobber a
  // freshly-minted credential the connector auto-merged but the SW cache hasn't
  // caught up on yet. Cleared on reset() (the connector is recreated).
  private replayedVendors = new Set<VendorType>();

  /** Cached unsubscribe fn returned by `onOffscreenEvent`. */
  private unsubscribeFromBus: (() => void) | null = null;

  /** Cached unsubscribe fn for the offscreen-side SDK event bus. */
  private unsubscribeFromHwkSdkEvent: (() => void) | null = null;

  // -------------------------------------------------------------------------
  // Forwarded methods
  // -------------------------------------------------------------------------

  async searchDevices(params: {
    vendor: VendorType;
    options?: IConnectorSearchDevicesOptions;
  }): Promise<ConnectorDevice[]> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] searchDevices vendor=${params.vendor}`,
    );
    await this.replayKnownCredentials(params.vendor);
    return offscreenApiProxy.thirdPartyHardware.searchDevices(params);
  }

  async connect(params: {
    vendor: VendorType;
    deviceId?: string;
  }): Promise<ConnectorSession> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] connect vendor=${params.vendor} deviceId=${
        params.deviceId ?? ''
      }`,
    );
    await this.replayKnownCredentials(params.vendor);
    return offscreenApiProxy.thirdPartyHardware.connect(params);
  }

  disconnect(params: { vendor: VendorType; sessionId: string }): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] disconnect vendor=${params.vendor} sessionId=${params.sessionId}`,
    );
    return offscreenApiProxy.thirdPartyHardware.disconnect(params);
  }

  async call(params: {
    vendor: VendorType;
    sessionId: string;
    method: string;
    callParams: unknown;
  }): Promise<ConnectorCallResult> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] call vendor=${params.vendor} method=${params.method}`,
    );
    await this.replayKnownCredentials(params.vendor);
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
    // The connector is recreated → its credentials must be re-pushed next time.
    this.replayedVendors.delete(params.vendor);
    void offscreenApiProxy.thirdPartyHardware.reset(params);
  }

  /**
   * Forward warm-load credentials to the offscreen connector. SW persists
   * Trezor THP credentials in secure storage; this is the path that pushes
   * them back into the connector on SW boot or after credential updates.
   * Returns a Promise so callers can await the offscreen ack — important
   * to chain "load credentials → first searchDevices" without racing.
   */
  setKnownCredentials(params: {
    vendor: VendorType;
    credentials: unknown[];
  }): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Bridge] setKnownCredentials vendor=${params.vendor} count=${params.credentials.length}`,
    );
    this.knownCredentialsByVendor.set(params.vendor, [...params.credentials]);
    const push =
      offscreenApiProxy.thirdPartyHardware.setKnownCredentials(params);
    // This already loads the connector, so replayKnownCredentials can skip.
    void push.then(() => {
      this.replayedVendors.add(params.vendor);
    });
    return push;
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
        this.rememberCredentialsFromEvent(
          payload.vendor as VendorType,
          payload.type,
          payload.data,
        );
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

  private replayKnownCredentials(vendor: VendorType): Promise<void> {
    // Only needed once per SW lifetime: the offscreen connector persists across
    // SW restarts and auto-merges newly-minted credentials itself, so re-pushing
    // on every call is redundant (and a reset that could drop fresh credentials).
    if (this.replayedVendors.has(vendor)) {
      return Promise.resolve();
    }
    const credentials = this.knownCredentialsByVendor.get(vendor);
    if (!credentials?.length) {
      return Promise.resolve();
    }
    const existing = this.replayCredentialsPromisesByVendor.get(vendor);
    if (existing) return existing;
    const replay = offscreenApiProxy.thirdPartyHardware
      .setKnownCredentials({ vendor, credentials })
      .then(() => {
        this.replayedVendors.add(vendor);
      })
      .finally(() => {
        this.replayCredentialsPromisesByVendor.delete(vendor);
      });
    this.replayCredentialsPromisesByVendor.set(vendor, replay);
    return replay;
  }

  private rememberCredentialsFromEvent(
    vendor: VendorType,
    type: ConnectorEventType,
    data: unknown,
  ): void {
    if (type !== 'device-trezor-thp-credentials-changed') return;
    const credentials = (data as { credentials?: unknown[] } | undefined)
      ?.credentials;
    if (!credentials?.length) return;
    const existing = this.knownCredentialsByVendor.get(vendor) ?? [];
    const merged = [...existing];
    for (const credential of credentials) {
      if (!this.hasCredential(merged, credential)) {
        merged.push(credential);
      }
    }
    this.knownCredentialsByVendor.set(vendor, merged);
  }

  private hasCredential(credentials: unknown[], credential: unknown): boolean {
    const key = this.getCredentialKey(credential);
    return credentials.some((item) => this.getCredentialKey(item) === key);
  }

  private getCredentialKey(credential: unknown): string {
    const raw = (credential as { credential?: unknown } | undefined)
      ?.credential;
    if (typeof raw === 'string') return raw;
    try {
      return JSON.stringify(credential);
    } catch {
      return String(credential);
    }
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
