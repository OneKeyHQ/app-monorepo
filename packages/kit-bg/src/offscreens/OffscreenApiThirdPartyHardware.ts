import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { emitOffscreenEventToBackground } from './offscreenEventBus';

import type {
  ConnectorDevice,
  ConnectorEventType,
  ConnectorSession,
  IConnector,
  IHardwareBridge,
  UiResponseEvent,
  VendorType,
} from '@onekeyfe/hwk-adapter-core';

/**
 * Offscreen-side implementation of `IHardwareBridge` for third-party hardware
 * wallets.
 *
 * This class lives only in the offscreen document. It owns the real SDK
 * `IConnector` instances (and the `navigator.hid` handles, DMK sessions, etc.
 * they hold) so they persist beyond any MV3 service-worker termination.
 *
 * Wiring:
 * - SW side builds a `createBridgedConnector('<vendor>', OffscreenHardwareBridgeClient)`
 *   whose `IConnector` methods tunnel here via `offscreenApiProxy.thirdPartyHardware`.
 * - This class receives those tunneled calls as plain async methods and
 *   forwards them to the real per-vendor connector.
 * - Connector events (`ui-event`, `device-connect`, `device-disconnect`,
 *   `ui-request`) are subscribed once per vendor and pushed back to SW via
 *   `offscreenEventBus` where `OffscreenHardwareBridgeClient` fans them out to
 *   whoever registered `onEvent(...)`.
 *
 * Adding a new vendor = one `case` in `createConnector()`. Everything else
 * is vendor-agnostic.
 */
export default class OffscreenApiThirdPartyHardware implements IHardwareBridge {
  private connectors = new Map<VendorType, IConnector>();

  private connectorInitPromises = new Map<VendorType, Promise<IConnector>>();

  // ---------------------------------------------------------------------------
  // Connector lifecycle (lazy init per vendor)
  // ---------------------------------------------------------------------------

  private async getConnector(vendor: VendorType): Promise<IConnector> {
    const existing = this.connectors.get(vendor);
    if (existing) return existing;
    let pending = this.connectorInitPromises.get(vendor);
    if (!pending) {
      pending = this.createConnector(vendor)
        .then((connector) => {
          this.connectors.set(vendor, connector);
          this.subscribeConnectorEvents(vendor, connector);
          return connector;
        })
        .catch((error) => {
          this.connectorInitPromises.delete(vendor);
          throw error;
        });
      this.connectorInitPromises.set(vendor, pending);
    }
    return pending;
  }

  private getConnectorSync(vendor: VendorType): IConnector | undefined {
    return this.connectors.get(vendor);
  }

  /**
   * Build the real per-vendor connector. Dynamic imports keep each vendor's
   * SDK chunk out of the main bundle.
   *
   * To add a vendor: append a `case` here. Keep connector construction the
   * only vendor-specific code — everything above/below is generic.
   */
  private async createConnector(vendor: VendorType): Promise<IConnector> {
    switch (vendor) {
      case 'ledger': {
        const { createLedgerWebHidConnector } =
          await import('@onekeyfe/hwk-ledger-connector-webhid');
        return createLedgerWebHidConnector();
      }
      default:
        throw new OneKeyLocalError(
          `OffscreenApiThirdPartyHardware: unsupported vendor '${
            vendor as string
          }'`,
        );
    }
  }

  /**
   * Forward every connector event onto the offscreen event bus. The shape is
   * `{ vendor, type, data }` — identical to what `IHardwareBridge.onEvent`
   * promises its handler, so the SW side can pass it through untouched.
   */
  private subscribeConnectorEvents(
    vendor: VendorType,
    connector: IConnector,
  ): void {
    const forward = (type: ConnectorEventType) => (data: unknown) => {
      emitOffscreenEventToBackground('thirdPartyHardwareConnectorEvent', {
        vendor,
        type,
        data,
      });
    };
    connector.on('device-connect', forward('device-connect'));
    connector.on('device-disconnect', forward('device-disconnect'));
    connector.on('ui-request', forward('ui-request'));
    connector.on('ui-event', forward('ui-event'));
  }

  // ---------------------------------------------------------------------------
  // IHardwareBridge — SW calls these via offscreenApiProxy.thirdPartyHardware
  // ---------------------------------------------------------------------------

  async searchDevices(params: {
    vendor: VendorType;
  }): Promise<ConnectorDevice[]> {
    const connector = await this.getConnector(params.vendor);
    return connector.searchDevices();
  }

  async connect(params: {
    vendor: VendorType;
    deviceId?: string;
  }): Promise<ConnectorSession> {
    const connector = await this.getConnector(params.vendor);
    return connector.connect(params.deviceId);
  }

  async disconnect(params: {
    vendor: VendorType;
    sessionId: string;
  }): Promise<void> {
    const connector = await this.getConnector(params.vendor);
    await connector.disconnect(params.sessionId);
  }

  async call(params: {
    vendor: VendorType;
    sessionId: string;
    method: string;
    callParams: unknown;
  }): Promise<unknown> {
    const connector = await this.getConnector(params.vendor);
    return connector.call(params.sessionId, params.method, params.callParams);
  }

  async cancel(params: {
    vendor: VendorType;
    sessionId: string;
  }): Promise<void> {
    const connector = await this.getConnector(params.vendor);
    await connector.cancel(params.sessionId);
  }

  uiResponse(params: { vendor: VendorType; response: UiResponseEvent }): void {
    // uiResponse is only meaningful if a connector already exists — a pending
    // UI request necessarily implies prior connector activity. If not, drop.
    const connector = this.getConnectorSync(params.vendor);
    connector?.uiResponse(params.response);
  }

  reset(params: { vendor: VendorType }): void {
    const connector = this.getConnectorSync(params.vendor);
    connector?.reset();
  }

  /**
   * `onEvent` / `offEvent` on this side are intentionally no-ops: the SW
   * subscribes to `offscreenEventBus` directly (see `OffscreenHardwareBridgeClient`),
   * not by calling into offscreen. Including them satisfies the
   * `IHardwareBridge` interface and documents the choice.
   */
  onEvent(
    _params: { vendor: VendorType },
    _handler: (event: { type: ConnectorEventType; data: unknown }) => void,
  ): void {
    // no-op — event delivery happens via offscreenEventBus instead.
  }

  offEvent(
    _params: { vendor: VendorType },
    _handler: (event: { type: ConnectorEventType; data: unknown }) => void,
  ): void {
    // no-op — matches onEvent.
  }
}
