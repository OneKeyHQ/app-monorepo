import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type {
  DeviceInfo,
  IConnector,
  IHardwareWallet,
  Response,
  UiResponseEvent,
} from '@onekeyfe/hwk-adapter-core';

export type { DeviceInfo, IHardwareWallet, Response, IConnector };

// =====================================================================
// UI Event types (OneKey-specific adapter UI layer)
// =====================================================================

export type IAdapterUiRequestType =
  | 'request-ledger-unlock'
  | 'request-ledger-retry';

export type IAdapterUiEventType =
  | 'ui-event-ledger-searching'
  | 'ui-event-ledger-connecting'
  | 'ui-event-ledger-open-app'
  | 'ui-event-ledger-confirm-on-device'
  | 'ui-event-ledger-processing'
  | 'ui-event-ledger-done'
  | 'ui-event-ledger-error';

export type IAdapterUiRequest = {
  kind: 'request';
  type: IAdapterUiRequestType;
  payload?: {
    message?: string;
    retryCount?: number;
    maxRetries?: number;
  };
};

export type IAdapterUiNotification = {
  kind: 'ui-event';
  type: IAdapterUiEventType;
  payload?: {
    chain?: string;
    message?: string;
  };
};

export type IAdapterUiEvent = IAdapterUiRequest | IAdapterUiNotification;

/** Alias of SDK's UiResponseEvent — the (type, payload) contract is SDK-owned. */
export type IAdapterUiResponse = UiResponseEvent;

/**
 * The narrow union of "vendors that currently have a registered adapter"
 * is derived from `thirdPartyHardwareAdapterRegistry` — import it from
 * `./thirdPartyHardwareAdapterRegistry` (or re-export via `./index`).
 * We keep `vendor` typed as the broader `EHardwareVendor` here to avoid
 * a types ↔ registry circular import.
 */
export interface IThirdPartyHardwareAdapter {
  readonly vendor: EHardwareVendor;
  readonly hw: IHardwareWallet;

  onUiEvent(handler: (event: IAdapterUiEvent) => void): () => void;
  uiResponse(response: IAdapterUiResponse): void;

  searchDevices(): Promise<DeviceInfo[]>;
  connectDevice(
    connectId: string,
  ): Promise<Response<{ connectId: string; deviceId: string }>>;
  disconnect(connectId: string): Promise<void>;
  reset(): void;
}
