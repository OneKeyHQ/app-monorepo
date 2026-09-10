import type {
  EHardwareVendor,
  IThirdPartyHardwareSearchTarget,
} from '@onekeyhq/shared/types/device';

import type { EThirdPartyHardwareUiAction } from '../../../states/jotai/atoms/hardware';
import type {
  DeviceInfo,
  DeviceSelectionRequest,
  IConnector,
  IDeviceManagerOperationContext,
  IHardwareConnectionContext,
  IHardwareWallet,
  Response,
  UiResponseEvent,
} from '@onekeyfe/hwk-adapter-core';

export type { DeviceInfo, IHardwareWallet, Response, IConnector };
export type { IDeviceManagerOperationContext };
export type { IHardwareConnectionContext };
export type { IThirdPartyHardwareSearchTarget };

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
  transportType?: 'usb' | 'ble' | 'qr';
};

export type IThirdPartyConnectedDevicePayload = {
  /** Runtime-only lifecycle id. It must never be written to the Device table. */
  interactionId: string;
  connectId: string;
  deviceId: string;
  model?: string;
  modelName?: string;
  label?: string;
  firmwareVersion?: string;
  connectionType?: 'usb' | 'ble' | 'qr';
  capabilities?: DeviceInfo['capabilities'];
  features?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export type IThirdPartyHardwareConnectionStateEvent =
  | {
      type: 'connected';
      device: IThirdPartyConnectedDevicePayload;
    }
  | {
      type: 'disconnected';
      interactionId: string;
    };

// =====================================================================
// UI Event types (OneKey-specific adapter UI layer)
// =====================================================================

export type IAdapterUiRequestType =
  | EThirdPartyHardwareUiAction.requestDeviceNotFound
  | EThirdPartyHardwareUiAction.requestDeviceSelection
  | EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm
  | EThirdPartyHardwareUiAction.requestKeystoneQrDisplay
  | EThirdPartyHardwareUiAction.requestKeystoneQrScan;

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
    /** Operation-first search results. Their ids are discovery-generation scoped. */
    deviceSearchTargets?: IThirdPartyHardwareSearchTarget[];
    deviceSelection?: Omit<DeviceSelectionRequest, 'devices'>;
    /** Keystone QR: BC-UR type of the payload to display. */
    urType?: string;
    /** Keystone QR: hex-encoded CBOR of the payload to display. */
    urData?: string;
    /** Keystone QR: hints the display payload needs multi-frame animated rendering. */
    animated?: boolean;
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
  onConnectionStateChange?(
    handler: (event: IThirdPartyHardwareConnectionStateEvent) => void,
  ): () => void;
  uiResponse(response: IAdapterUiResponse): void;
  cancel(connectId?: string): void;

  searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]>;
  searchDeviceTargets(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<IThirdPartyHardwareSearchTarget[]>;
  connectDevice(
    searchTargetId: string,
    operationContext?: IHardwareConnectionContext,
  ): Promise<Response<IThirdPartyConnectedDevicePayload>>;
  releaseInteraction(interactionId: string): Promise<void>;
  reset(): Promise<void>;

  deviceSettings?(
    connectId: string,
    params: TrezorDeviceSettingsParams,
    operationContext?: IDeviceManagerOperationContext,
  ): Promise<Response<Record<string, unknown>>>;
  setBrightness?(
    connectId: string,
    params?: TrezorBrightnessParams,
    operationContext?: IDeviceManagerOperationContext,
  ): Promise<Response<Record<string, unknown>>>;
  changePin?(
    connectId: string,
    params?: TrezorChangePinParams,
    operationContext?: IDeviceManagerOperationContext,
  ): Promise<Response<Record<string, unknown>>>;
  wipeDevice?(
    connectId: string,
    operationContext?: IDeviceManagerOperationContext,
  ): Promise<Response<Record<string, unknown>>>;

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
}
