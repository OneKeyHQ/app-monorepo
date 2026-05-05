import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { EThirdPartyHardwareUiAction } from '../../../states/jotai/atoms/hardware';
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

export type IAdapterUiRequestType = EThirdPartyHardwareUiAction.requestUnlock;

export type IAdapterUiRequest = {
  kind: 'request';
  type: IAdapterUiRequestType;
  payload?: {
    message?: string;
  };
};

export type IAdapterUiEvent = IAdapterUiRequest;

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
  cancel(connectId?: string): void;

  searchDevices(): Promise<DeviceInfo[]>;
  connectDevice(
    connectId: string,
  ): Promise<Response<{ connectId: string; deviceId: string }>>;
  disconnect(connectId: string): Promise<void>;
  reset(): void;
}
