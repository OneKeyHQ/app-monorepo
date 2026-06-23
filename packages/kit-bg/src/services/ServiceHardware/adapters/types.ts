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

export type TrezorDisplayRotation = 'North' | 'East' | 'South' | 'West';
export type TrezorSafetyCheckLevel =
  | 'Strict'
  | 'PromptAlways'
  | 'PromptTemporarily';
export type TrezorDeviceSettingsParams = {
  language?: string;
  label?: string;
  use_passphrase?: boolean;
  homescreen?: string;
  auto_lock_delay_ms?: number;
  display_rotation?: TrezorDisplayRotation;
  passphrase_always_on_device?: boolean;
  safety_checks?: TrezorSafetyCheckLevel;
  experimental_features?: boolean;
  hide_passphrase_from_host?: boolean;
  haptic_feedback?: boolean;
  auto_lock_delay_battery_ms?: number;
};
export type TrezorBrightnessParams = { value?: number };
export type TrezorChangePinParams = { remove?: boolean };

export type IThirdPartyHardwareSearchOptions = {
  resetSession?: boolean;
  waitForAllTransports?: boolean;
  transportType?: 'usb' | 'ble';
};

export type IThirdPartyConnectedDevicePayload = {
  connectId: string;
  deviceId: string;
  model?: string;
  modelName?: string;
  label?: string;
  firmwareVersion?: string;
  features?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

// =====================================================================
// UI Event types (OneKey-specific adapter UI layer)
// =====================================================================

export type IAdapterUiRequestType =
  | EThirdPartyHardwareUiAction.requestDeviceNotFound
  | EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm;

export type IAdapterUiRequest = {
  kind: 'request';
  type: IAdapterUiRequestType;
  payload?: {
    /** Vendor that emitted the request, e.g. 'ledger'. */
    vendor?: string;
    /** Why the SDK is asking for a reconnect (e.g. 'device-not-found'). */
    reason?: string;
    /** Best-effort English fallback when vendor+reason isn't recognized. */
    message?: string;
    /** BIP-44 path the SDK is asking about (BTC high-index confirm). */
    path?: string;
    /** Account index parsed from the path (BTC high-index confirm). */
    accountIndex?: number;
  };
};

export type IAdapterUiEvent = IAdapterUiRequest;

/** Alias of SDK's UiResponseEvent — the (type, payload) contract is SDK-owned. */
export type IAdapterUiResponse = UiResponseEvent;

export interface IThirdPartyHardwareAdapter {
  readonly vendor: EHardwareVendor;
  readonly hw: IHardwareWallet;
  readonly supportsAllNetworkGetAddress?: boolean;

  onUiEvent(handler: (event: IAdapterUiEvent) => void): () => void;
  uiResponse(response: IAdapterUiResponse): void;
  cancel(connectId?: string): void;

  searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]>;
  connectDevice(
    connectId: string,
  ): Promise<Response<IThirdPartyConnectedDevicePayload>>;
  disconnect(connectId: string): Promise<void>;
  reset(): void;

  deviceSettings?(
    connectId: string,
    params: TrezorDeviceSettingsParams,
  ): Promise<Response<Record<string, unknown>>>;
  setBrightness?(
    connectId: string,
    params?: TrezorBrightnessParams,
  ): Promise<Response<Record<string, unknown>>>;
  changePin?(
    connectId: string,
    params?: TrezorChangePinParams,
  ): Promise<Response<Record<string, unknown>>>;
  wipeDevice?(connectId: string): Promise<Response<Record<string, unknown>>>;

  /**
   * Trezor-only: flush this device's buffered THP pairing credentials into its
   * DB settings. Pairing can precede the device record (created during
   * createHWWallet), so the host calls this once the record exists. Optional —
   * adapters without host-managed pairing credentials (Ledger) omit it.
   */
  flushThpCredentials?(
    deviceId: string,
    options?: { connectId?: string },
  ): Promise<void>;

  /**
   * Trezor-only: mark a USB→BLE binding probe as active for `connectId`. While
   * active, a pairing request from that candidate is cancelled silently instead
   * of surfacing the THP pairing dialog (a non-matching candidate is "not this
   * one"). Call endBindingProbe() when the probe finishes. Optional — adapters
   * without host-managed pairing (Ledger) omit it.
   */
  beginBindingProbe?(connectId: string): void;
  endBindingProbe?(): void;
}
