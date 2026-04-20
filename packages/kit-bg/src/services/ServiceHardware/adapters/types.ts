import { EThirdPartyHardwareUiAction } from '../../../states/jotai/atoms/hardware';

import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type {
  DeviceInfo,
  IConnector,
  IHardwareWallet,
  Response,
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

export type IAdapterUiResponse = {
  type: 'confirm' | 'cancel';
  payload?: {
    pin?: string;
    passphrase?: string;
  };
};

/** Non-interactive notifications — user acts on the physical device, not in the app. */
const TOAST_ACTIONS: Set<string> = new Set<string>([
  EThirdPartyHardwareUiAction.confirmOnDevice,
  EThirdPartyHardwareUiAction.openApp,
  EThirdPartyHardwareUiAction.searching,
]);

/** Also treat unlock-device as toast (defined in atom types, not in IAdapterUiEventType). */
const TOAST_ACTIONS_EXTRA = new Set([EThirdPartyHardwareUiAction.unlockDevice]);

/** Is this a non-interactive notification that should show as a Toast (not Dialog)? */
export function isThirdPartyToastAction(action: string | undefined): boolean {
  return (
    !!action &&
    (TOAST_ACTIONS.has(action) ||
      TOAST_ACTIONS_EXTRA.has(action as EThirdPartyHardwareUiAction))
  );
}

/** Is this a "confirm on device" action specifically? (used by ReceiveToken for address display) */
export function isThirdPartyConfirmOnDevice(
  action: string | undefined,
): boolean {
  return action === EThirdPartyHardwareUiAction.confirmOnDevice;
}

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
