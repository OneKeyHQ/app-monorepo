import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getTrezorThpIdentity } from '@onekeyhq/shared/src/hardware/trezorThpIdentity';
import { sanitizeTrezorThpModuleLogData } from '@onekeyhq/shared/src/hardware/trezorThpLogRedact';

import { emitOffscreenEventToBackground } from './offscreenEventBus';

import type {
  ConnectorCallResult,
  ConnectorDevice,
  ConnectorEventType,
  ConnectorSession,
  IConnector,
  IHardwareBridge,
  UiResponseEvent,
  VendorType,
} from '@onekeyfe/hwk-adapter-core';

type ITrezorDebugLogEntry = {
  level?: 'debug' | 'info' | 'warn' | 'error';
  scope?: string;
  event?: string;
  data?: Record<string, unknown>;
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

// Redact THP secrets (packetHex / credentials / keys) before the payload
// leaves the offscreen doc — it lands in the persisted, exportable bg sdkLog.
const formatTrezorDebugLog = (entry: ITrezorDebugLogEntry): string =>
  `[${entry.scope ?? 'unknown'}] ${entry.event ?? 'log'} ${
    entry.data ? safeStringify(sanitizeTrezorThpModuleLogData(entry.data)) : ''
  }`.trim();

/**
 * Offscreen-doc server for `IHardwareBridge` — owns the per-vendor
 * `IConnector` instances (and the `navigator.hid` handles they hold) so
 * they outlive MV3 service-worker termination. SW tunnels calls here via
 * `offscreenApiProxy.thirdPartyHardware`; connector events flow back
 * through `offscreenEventBus`. New vendor = one `case` in `createConnector()`.
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
        .finally(() => {
          this.connectorInitPromises.delete(vendor);
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
        // Forward the whole SdkEvent union to SW; new variants ride this
        // same channel without a new IPC route.
        const { onSdkEvent } = await import('@onekeyfe/hwk-ledger-adapter');
        onSdkEvent((event) => {
          emitOffscreenEventToBackground('hwkSdkEvent', event);
        });
        const { createLedgerWebHidConnector } =
          await import('@onekeyfe/hwk-ledger-connector-webhid');
        return createLedgerWebHidConnector();
      }
      case 'trezor': {
        const thpIdentity = getTrezorThpIdentity();
        // THP host identity is burned in at connector construction and shown
        // on the device pairing screen. Keep it stable and non-sensitive.
        const { createTrezorWebUsbConnector } =
          await import('@onekeyfe/hwk-trezor-connector-webusb');
        const logger = (entry: ITrezorDebugLogEntry) => {
          emitOffscreenEventToBackground('hwkSdkEvent', {
            type: 'log',
            level: entry.level ?? 'debug',
            message: formatTrezorDebugLog(entry),
          });
        };
        return createTrezorWebUsbConnector({
          thp: {
            hostName: thpIdentity.hostName,
            appName: thpIdentity.appName,
            logger,
          },
          transportOptions: {
            logger,
          },
        });
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
    // ui-event also carries app install progress (AppInstallProgress variant).
    connector.on('ui-event', forward('ui-event'));
    // ui-request: Trezor THP needs to ask the host to render UI (pairing
    // code entry, button-press prompt). Ledger doesn't emit this but
    // forwarding for all vendors costs nothing and keeps the IConnector
    // contract honest.
    connector.on('ui-request', forward('ui-request'));
    // Trezor THP pairing credentials refresh — fire-and-forget event the
    // SW persists to secure storage and replays on the next SW boot via
    // setKnownCredentials(). Ledger doesn't emit it; forwarding is no-op.
    connector.on(
      'device-trezor-thp-credentials-changed',
      forward('device-trezor-thp-credentials-changed'),
    );
  }

  // ---------------------------------------------------------------------------
  // IHardwareBridge — SW calls these via offscreenApiProxy.thirdPartyHardware
  // ---------------------------------------------------------------------------

  async searchDevices(params: {
    vendor: VendorType;
    options?: { waitForAll?: boolean };
  }): Promise<ConnectorDevice[]> {
    const connector = await this.getConnector(params.vendor);
    return (
      connector as IConnector & {
        searchDevices(options?: {
          waitForAll?: boolean;
        }): Promise<ConnectorDevice[]>;
      }
    ).searchDevices(params.options);
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
  }): Promise<ConnectorCallResult> {
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
   * Warm-load vendor-specific persisted credentials onto the connector. SW
   * boot path calls this with Trezor THP credentials read from secure
   * storage so the next handshake hits the autoconnect path. No-op for
   * vendors whose connector doesn't expose `setKnownCredentials`
   * (Ledger, etc.).
   *
   * Triggers connector init if it hasn't started — we want the credentials
   * loaded before the user's first searchDevices/connect call races us.
   */
  async setKnownCredentials(params: {
    vendor: VendorType;
    credentials: unknown[];
  }): Promise<void> {
    const connector = await this.getConnector(params.vendor);
    await connector.setKnownCredentials?.(params.credentials);
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
