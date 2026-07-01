import { DEVICE, EConnectorInteraction } from '@onekeyfe/hwk-adapter-core';
import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core/errors';
import { UI_REQUEST, UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';

import localDb from '@onekeyhq/kit-bg/src/dbs/local/localDb';
import type {
  IDBDevice,
  ITrezorThpCredential,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { BaseAdapter } from './BaseAdapter';

import type {
  DeviceInfo,
  IHardwareWallet,
  IThirdPartyConnectedDevicePayload,
  IThirdPartyHardwareAdapter,
  IThirdPartyHardwareSearchOptions,
  Response,
  TrezorBrightnessParams,
  TrezorChangePinParams,
  TrezorDeviceSettingsParams,
} from './types';

const TREZOR_THP_TRACE_KEY = 'TrezorTHPTrace';
const TREZOR_FEATURES_EVENT = 'features';
const TREZOR_PROCESSING_UI_EXCLUDED_HW_METHODS = new Set([
  'cancel',
  'connectDevice',
  'deviceSettings',
  'disconnectDevice',
  'dispose',
  'getDeviceInfo',
  'off',
  'on',
  'resetState',
  'searchDevices',
  'setBrightness',
  'uiResponse',
  'changePin',
  'wipeDevice',
]);

type ITrezorSupportFeaturesEvent = {
  device?: {
    connectId?: string;
    deviceId?: string;
    features?: Record<string, unknown>;
  };
  payload?: {
    device?: {
      connectId?: string;
      deviceId?: string;
      features?: Record<string, unknown>;
    };
  };
};

type ITrezorHardwareWalletExtensions = {
  deviceSettings?: (
    connectId: string,
    params: TrezorDeviceSettingsParams,
  ) => Promise<Response<Record<string, unknown>>>;
  setBrightness?: (
    connectId: string,
    params?: TrezorBrightnessParams,
  ) => Promise<Response<Record<string, unknown>>>;
  changePin?: (
    connectId: string,
    params?: TrezorChangePinParams,
  ) => Promise<Response<Record<string, unknown>>>;
  wipeDevice?: (
    connectId: string,
  ) => Promise<Response<Record<string, unknown>>>;
};

/**
 * Trezor third-party hardware adapter.
 *
 * The big shape difference from `LedgerAdapter`:
 *   - Trezor THP has a *blocking* UI step (CodeEntry pairing) — the SDK
 *     pauses until the user reads a code off the device screen and types
 *     it back. That's surfaced as `requestTrezorThpPairing` (Dialog with
 *     text input + Submit), not a passive toast.
 *   - Trezor mints pairing credentials on each first-time pair; we persist
 *     `DEVICE.TREZOR_THP_CREDENTIALS_CHANGED` into the device's own DB
 *     settings (per-device, so forget-device clears them) so subsequent
 *     handshakes hit the auto-connect path. The connector self-mutates its
 *     in-memory array on the same event, so persisted credentials and live
 *     state stay in sync without an extra setKnownCredentials roundtrip.
 *   - Trezor THP has no "open app" / "BTC high index" concepts — those
 *     branches are Ledger-only.
 */
export class TrezorAdapter
  extends BaseAdapter
  implements IThirdPartyHardwareAdapter
{
  readonly vendor = EHardwareVendor.trezor;

  readonly supportsAllNetworkGetAddress = true;

  readonly hw: IHardwareWallet;

  private _disposeSdkEvents?: () => void;

  private _processingDepth = 0;

  private _searchDevicesDepth = 0;

  // THP credentials minted this session, keyed by raw deviceId. Credentials are
  // minted at PAIRING — which can happen before the device's DB record exists
  // (during createHWWallet). We buffer them here and flush into the device's
  // settings either immediately (record already present) or via
  // flushThpCredentials() once the record is created.
  private readonly _thpCredentialsByDevice = new Map<
    string,
    ITrezorThpCredential[]
  >();

  private readonly _featuresDeviceIdByConnectId = new Map<string, string>();

  // While a USB→BLE binding probe is connecting to a candidate, a non-matching
  // device asks to pair. That's the "not this one" signal — cancel it silently
  // instead of popping the THP pairing dialog. Set by beginBindingProbe().
  private _bindingProbeConnectId?: string;

  beginBindingProbe(connectId: string): void {
    this._bindingProbeConnectId = connectId;
  }

  endBindingProbe(): void {
    this._bindingProbeConnectId = undefined;
  }

  constructor(hw: IHardwareWallet, disposeSdkEvents?: () => void) {
    super();
    this.hw = this._createProcessingAwareHw(hw);
    this._disposeSdkEvents = disposeSdkEvents;
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Trezor] adapter created');

    // Generic ui-events (searching / confirm-on-device / interaction-complete)
    // mirror Ledger handling — the connector emits the same EConnectorInteraction
    // taxonomy. Vendor-specific events that don't apply to Trezor (openApp,
    // unlockDevice DMK polling) are silently ignored.
    this.hw.on('ui-event', (event) => {
      const eventType = (event as { type?: string }).type ?? 'unknown';
      defaultLogger.hardware.sdkLog.uiEvent(
        `[3rdPartyHW][Trezor] ${eventType}`,
        event,
      );
      switch (event.type) {
        case EConnectorInteraction.Searching:
          if (this._searchDevicesDepth === 0) {
            void thirdPartyHardwareUiStateAtom.set({
              action: EThirdPartyHardwareUiAction.searching,
              vendor: EHardwareVendor.trezor,
            });
          }
          break;
        case EConnectorInteraction.ConfirmOnDevice:
          this._setUiState(EThirdPartyHardwareUiAction.confirmOnDevice);
          break;
        case EConnectorInteraction.InteractionComplete:
          this._clearUiState();
          break;
        default: {
          defaultLogger.hardware.sdkLog.log(
            `[3rdPartyHW][Trezor] Unhandled SDK ui-event type: ${eventType}`,
          );
          break;
        }
      }
    });

    this.hw.on(UI_REQUEST.REQUEST_DEVICE_CONNECT, (event) => {
      const { vendor, reason, message } = event.payload as {
        vendor?: string;
        reason?: string;
        message?: string;
      };
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] REQUEST_DEVICE_CONNECT vendor=${
          vendor ?? '-'
        } reason=${reason ?? '-'}`,
      );
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] REQUEST_DEVICE_CONNECT message=${message ?? '-'}`,
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestDeviceNotFound,
        payload: {
          vendor,
          reason,
          message,
        },
      });
    });

    // THP pairing — blocking, needs Dialog with text input. The UI Container
    // reads `payload.availableMethods/selectedMethod` to render context (which
    // pairing flow the device is in) and posts back via
    // `RECEIVE_TREZOR_THP_PAIRING { tag }`.
    this.hw.on(UI_REQUEST.REQUEST_TREZOR_THP_PAIRING, (event) => {
      const payload = event.payload as {
        connectId?: string;
        availableMethods?: number[];
        selectedMethod?: number;
        nfcData?: string;
      };
      // During a binding probe, a candidate asking to pair means "not this
      // device" — cancel silently rather than surfacing the pairing dialog.
      if (
        this._bindingProbeConnectId &&
        (!payload.connectId ||
          payload.connectId === this._bindingProbeConnectId)
      ) {
        void this.hw.cancel(this._bindingProbeConnectId);
        return;
      }
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] REQUEST_TREZOR_THP_PAIRING method=${
          payload.selectedMethod ?? '-'
        }`,
      );
      void thirdPartyHardwareUiStateAtom.set({
        action: EThirdPartyHardwareUiAction.requestTrezorThpPairing,
        vendor: EHardwareVendor.trezor,
        payload: {
          connectId: payload.connectId,
          availableMethods: payload.availableMethods,
          selectedMethod: payload.selectedMethod,
          nfcData: payload.nfcData,
        },
      });
    });

    this.hw.on(TREZOR_FEATURES_EVENT, (event) => {
      const message = event as ITrezorSupportFeaturesEvent;
      const device = message.device || message.payload?.device;
      const features = device?.features;
      const featuresDeviceId =
        typeof features?.device_id === 'string'
          ? features.device_id
          : undefined;
      if (!features || !featuresDeviceId) return;
      this._rememberConnectIdDeviceIdMapping({
        connectId: device?.connectId,
        featuresDeviceId,
      });
      if (device?.deviceId && device.deviceId !== featuresDeviceId) {
        this._rememberConnectIdDeviceIdMapping({
          connectId: device.deviceId,
          featuresDeviceId,
        });
      }
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] FEATURES deviceId=${featuresDeviceId}`,
      );
      void localDb.updateThirdPartyDeviceFeatures({
        vendor: EHardwareVendor.trezor,
        features: features as unknown as IOneKeyDeviceFeatures,
      });
    });

    // Passphrase request. The device/protocol asks only when passphrase input is
    // needed. Auto-answer the main wallet only when the caller explicitly opted
    // into `useEmptyPassphrase`; otherwise surface the host passphrase UI.
    this.hw.on(UI_REQUEST.REQUEST_PASSPHRASE, (event) => {
      const payload = event.payload as {
        connectId?: string;
        passphraseState?: string;
        useEmptyPassphrase?: boolean;
      };
      const connectId = payload.connectId;
      if (payload.useEmptyPassphrase === true) {
        defaultLogger.hardware.sdkLog.log(
          '[3rdPartyHW][Trezor] REQUEST_PASSPHRASE -> empty passphrase (main wallet)',
        );
        this.uiResponse({
          type: UI_RESPONSE.RECEIVE_PASSPHRASE,
          payload: { value: '' },
        });
        return;
      }
      if (connectId) {
        const passphraseState = payload.passphraseState;
        defaultLogger.hardware.sdkLog.log(
          '[3rdPartyHW][Trezor] REQUEST_PASSPHRASE -> host passphrase UI',
        );
        void thirdPartyHardwareUiStateAtom.set({
          action: EThirdPartyHardwareUiAction.requestTrezorPassphrase,
          vendor: EHardwareVendor.trezor,
          payload: {
            connectId,
            ...(passphraseState ? { passphraseState } : {}),
          },
        });
        return;
      }
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW][Trezor] REQUEST_PASSPHRASE -> host passphrase UI',
      );
      void thirdPartyHardwareUiStateAtom.set({
        action: EThirdPartyHardwareUiAction.requestTrezorPassphrase,
        vendor: EHardwareVendor.trezor,
        payload: {},
      });
    });

    // Old button devices prompt for the PIN on the host matrix → RECEIVE_PIN
    // (touchscreen devices enter on-device via REQUEST_BUTTON instead).
    this.hw.on(UI_REQUEST.REQUEST_PIN, (event) => {
      const payload = event.payload as { connectId?: string; type?: string };
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW][Trezor] REQUEST_PIN -> host PIN matrix',
      );
      void thirdPartyHardwareUiStateAtom.set({
        action: EThirdPartyHardwareUiAction.requestTrezorPin,
        vendor: EHardwareVendor.trezor,
        payload: payload.connectId ? { connectId: payload.connectId } : {},
      });
    });

    // THP lock — emitted as a REQUEST_BUTTON with code=ButtonRequest_PinEntry
    // by hwk-trezor-core when ThpDeviceLocked → tryToUnlock retry. Surface as
    // a toast; the SDK's THP read blocks on its own until the user enters
    // their PIN on device, no action needed from us.
    // Trezor `ButtonRequest` carries a precise `code` enum — dispatch on it
    // directly. The SDK no longer emits the generic `confirm-on-device`
    // ui-event for Trezor (that channel was the Ledger fallback), so this
    // handler is the SOLE source of "user has to interact with device"
    // signals for the Trezor path.
    this.hw.on(UI_REQUEST.REQUEST_BUTTON, (event) => {
      const payload = event.payload as { code?: string };
      const code = payload.code ?? 'ButtonRequest_Other';
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] REQUEST_BUTTON code=${code}`,
      );
      // PIN entry on device touchscreen — reuse the shared `unlockDevice` action.
      if (code === 'ButtonRequest_PinEntry') {
        void thirdPartyHardwareUiStateAtom.set({
          action: EThirdPartyHardwareUiAction.unlockDevice,
          vendor: EHardwareVendor.trezor,
        });
        return;
      }
      // PassphraseEntry / MnemonicInput / ConfirmWord — typing-on-device UX.
      // Future work: each gets its own UI action + UI surface. For now we
      // funnel them through the generic confirm-on-device toast so the user
      // at least sees *something* and looks at the device screen.
      // TODO(trezor): dedicated UI actions + atoms for these once we have
      //   the passphrase / recovery flows wired.
      // Everything else (ConfirmOutput / SignTx / Address / FeeOverThreshold /
      // ProtectCall / etc.) is "look at device, tap OK" → confirm-on-device.
      void thirdPartyHardwareUiStateAtom.set({
        action: EThirdPartyHardwareUiAction.confirmOnDevice,
        vendor: EHardwareVendor.trezor,
      });
    });

    // Persistent credentials: the connector self-mutates its in-memory
    // knownCredentials array on this same event (auto-dedup, all devices). The
    // event payload, however, carries just THIS device's credentials tagged
    // with its deviceId — so we persist them per-device into the device's own
    // settings (forget-device then clears them for free). Buffer first because
    // pairing can precede the device's DB record (see flushThpCredentials).
    this.hw.on(DEVICE.TREZOR_THP_CREDENTIALS_CHANGED, (event) => {
      const payload = event.payload as {
        connectId?: string;
        deviceId?: string;
        credentials: ITrezorThpCredential[];
      };
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] THP_CREDENTIALS_CHANGED count=${payload.credentials.length} connectId=${
          payload.connectId ?? '-'
        } deviceId=${payload.deviceId ?? '-'}`,
      );
      this._traceThp('event.credentialsChanged', {
        connectId: payload.connectId,
        eventDeviceId: payload.deviceId,
        credentialsCount: payload.credentials.length,
        mappedFeaturesDeviceId: payload.connectId
          ? this._featuresDeviceIdByConnectId.get(payload.connectId)
          : undefined,
      });
      this._rememberThpCredentials(
        {
          connectId: payload.connectId,
          deviceId: payload.deviceId,
          featuresDeviceId: payload.connectId
            ? this._featuresDeviceIdByConnectId.get(payload.connectId)
            : undefined,
        },
        payload.credentials,
      );
      // Persist now if the device record already exists (re-pairing); otherwise
      // it stays buffered until flushThpCredentials() after createHWWallet.
      void this._persistThpCredentials({
        connectId: payload.connectId,
        deviceId: payload.deviceId,
      });
    });

    this.hw.on(UI_REQUEST.CLOSE_UI_WINDOW, () => {
      defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Trezor] CLOSE_UI_WINDOW');
      this._clearUiState();
    });

    this.onUiEvent((event) => {
      if (event.kind === 'request') {
        void thirdPartyHardwareUiStateAtom.set({
          action: event.type as EThirdPartyHardwareUiAction,
          vendor: EHardwareVendor.trezor,
          payload: event.payload as IThirdPartyHardwareUiState['payload'],
        });
      }
    });
  }

  private _setUiState(
    action: EThirdPartyHardwareUiAction,
    payload?: IThirdPartyHardwareUiState['payload'],
  ): void {
    void thirdPartyHardwareUiStateAtom.set({
      action,
      vendor: EHardwareVendor.trezor,
      ...(payload ? { payload } : {}),
    });
  }

  private _clearUiState(): void {
    if (this._processingDepth > 0) {
      this._setUiState(EThirdPartyHardwareUiAction.processing);
      return;
    }
    this._forceClearUiState();
  }

  private _forceClearUiState(): void {
    void thirdPartyHardwareUiStateAtom.set(undefined);
  }

  private async _runWithProcessing<T>(operation: () => Promise<T>): Promise<T> {
    this._processingDepth += 1;
    this._setUiState(EThirdPartyHardwareUiAction.processing);
    try {
      return await operation();
    } finally {
      this._processingDepth = Math.max(0, this._processingDepth - 1);
      if (this._processingDepth > 0) {
        this._setUiState(EThirdPartyHardwareUiAction.processing);
      } else {
        this._forceClearUiState();
      }
    }
  }

  private _createProcessingAwareHw(hw: IHardwareWallet): IHardwareWallet {
    return new Proxy(hw, {
      get: (target, property, receiver) => {
        const value: unknown = Reflect.get(target, property, receiver);
        if (typeof property !== 'string' || typeof value !== 'function') {
          return value;
        }
        const boundMethod = (value as (...args: unknown[]) => unknown).bind(
          target,
        );
        if (TREZOR_PROCESSING_UI_EXCLUDED_HW_METHODS.has(property)) {
          return boundMethod;
        }
        return (...args: unknown[]) =>
          this._runWithProcessing(() => Promise.resolve(boundMethod(...args)));
      },
    });
  }

  // Flush this device's buffered THP credentials into its DB settings. Called
  // after createHWWallet persists the device record (pairing happened earlier,
  // before the record existed). No-op if nothing was buffered for this device.
  async flushThpCredentials(
    deviceId: string,
    options?: { connectId?: string },
  ): Promise<void> {
    await this._persistThpCredentials({
      connectId: options?.connectId,
      deviceId,
    });
  }

  private _getThpCredentialKeys({
    connectId,
    deviceId,
    featuresDeviceId,
  }: {
    connectId?: string;
    deviceId?: string;
    featuresDeviceId?: string;
  }): string[] {
    return [featuresDeviceId, deviceId, connectId].filter(
      (key, index, keys): key is string =>
        Boolean(key) && keys.indexOf(key) === index,
    );
  }

  private _rememberThpCredentials(
    lookup: {
      connectId?: string;
      deviceId?: string;
      featuresDeviceId?: string;
    },
    credentials: ITrezorThpCredential[] | undefined,
  ): void {
    if (!credentials?.length) return;
    for (const key of this._getThpCredentialKeys(lookup)) {
      this._thpCredentialsByDevice.set(key, credentials);
    }
  }

  private _rememberConnectIdDeviceIdMapping({
    connectId,
    featuresDeviceId,
  }: {
    connectId?: string;
    featuresDeviceId?: string;
  }): void {
    if (!connectId || !featuresDeviceId) return;
    this._featuresDeviceIdByConnectId.set(connectId, featuresDeviceId);
    const credentials = this._thpCredentialsByDevice.get(connectId);
    if (credentials?.length) {
      this._thpCredentialsByDevice.set(featuresDeviceId, credentials);
    }
    this._traceThp('map.connectIdToFeaturesDeviceId', {
      connectId,
      featuresDeviceId,
      movedBufferedCredentials: Boolean(credentials?.length),
      bufferedKeys: Array.from(this._thpCredentialsByDevice.keys()),
    });
  }

  private _traceThp(event: string, data?: Record<string, unknown>) {
    if (!this._shouldTraceThpPersistence()) {
      return;
    }
    let dataText = '';
    if (data) {
      try {
        dataText = ` ${JSON.stringify(data)}`;
      } catch {
        dataText = ' {"stringifyError":true}';
      }
    }
    defaultLogger.hardware.sdkLog.log(
      `[${TREZOR_THP_TRACE_KEY}][${event}]${dataText}`,
    );
  }

  private _shouldTraceThpPersistence() {
    try {
      return (
        typeof globalThis !== 'undefined' &&
        (globalThis as { localStorage?: Storage }).localStorage?.getItem(
          'debug.trezor.thpTrace',
        ) === '1'
      );
    } catch {
      return false;
    }
  }

  private _buildThpDebugDbDevice(device: IDBDevice | undefined) {
    if (!device) return undefined;
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(device.settingsRaw || '{}');
    } catch {
      // ignore malformed debug-only settings.
    }
    const thpCredentials = settings.thpCredentials;
    const thpCredentialsCount = Array.isArray(thpCredentials)
      ? thpCredentials.length
      : 0;
    return {
      id: device.id,
      connectId: device.connectId,
      deviceId: device.deviceId,
      usbConnectId: device.usbConnectId,
      bleConnectId: device.bleConnectId,
      features: device.features,
      settingsKeys: Object.keys(settings),
      hasThpCredentials: thpCredentialsCount > 0,
      thpCredentialsCount,
      vendor: settings.vendor,
      vendorModel: settings.vendorModel,
      vendorModelName: settings.vendorModelName,
    };
  }

  private async _traceThpPersistMiss({
    connectId,
    deviceId,
  }: {
    connectId?: string;
    deviceId?: string;
  }) {
    if (!this._shouldTraceThpPersistence()) {
      return;
    }
    try {
      const { devices } = await localDb.getAllDevices();
      const normalizedConnectId = connectId?.toLowerCase();
      const normalizedDeviceId = deviceId?.toLowerCase();
      const candidates = devices
        .filter((device) => {
          if (device.vendor === EHardwareVendor.trezor) return true;
          const connectIds = [
            device.connectId,
            device.usbConnectId,
            device.bleConnectId,
          ].map((value) => value?.toLowerCase());
          const matchesConnectId = Boolean(
            normalizedConnectId && connectIds.includes(normalizedConnectId),
          );
          return matchesConnectId;
        })
        .map((device) => this._buildThpDebugDbDevice(device));
      this._traceThp('persist.miss.devices', {
        connectId,
        deviceId,
        candidates,
        totalDevices: devices.length,
        matchedCandidateCount: candidates.length,
      });
      if (normalizedDeviceId && normalizedDeviceId !== normalizedConnectId) {
        const deviceIdCandidates = devices
          .filter(
            (device) => device.deviceId?.toLowerCase() === normalizedDeviceId,
          )
          .map((device) => this._buildThpDebugDbDevice(device));
        this._traceThp('persist.miss.deviceIdCandidates', {
          deviceId,
          candidates: deviceIdCandidates,
        });
      }
    } catch (error) {
      this._traceThp('persist.miss.devices.error', {
        message: (error as Error)?.message ?? String(error),
      });
    }
  }

  private async _persistThpCredentials({
    connectId,
    deviceId,
  }: {
    connectId?: string;
    deviceId?: string;
  }): Promise<void> {
    const mappedFeaturesDeviceId = connectId
      ? this._featuresDeviceIdByConnectId.get(connectId)
      : undefined;
    const lookupKeys = this._getThpCredentialKeys({
      connectId,
      deviceId,
      featuresDeviceId: mappedFeaturesDeviceId,
    });
    const credentials = lookupKeys
      .map((key) => this._thpCredentialsByDevice.get(key))
      .find((item) => item?.length);
    this._traceThp('persist.start', {
      connectId,
      deviceId,
      mappedFeaturesDeviceId,
      lookupKeys,
      hasCredentials: Boolean(credentials?.length),
      bufferedKeys: Array.from(this._thpCredentialsByDevice.keys()),
    });
    if (!credentials?.length) {
      return;
    }
    try {
      let device = deviceId
        ? await localDb.getDeviceByQuery({
            featuresDeviceId: deviceId,
            vendor: EHardwareVendor.trezor,
          })
        : undefined;
      this._traceThp('persist.lookup', {
        lookupType: 'featuresDeviceId',
        lookupValue: deviceId,
        found: Boolean(device),
        dbDevice: this._buildThpDebugDbDevice(device),
      });
      if (!device && connectId) {
        device = await localDb.getDeviceByQuery({
          connectId,
          vendor: EHardwareVendor.trezor,
        });
        this._traceThp('persist.lookup', {
          lookupType: 'connectId',
          lookupValue: connectId,
          found: Boolean(device),
          dbDevice: this._buildThpDebugDbDevice(device),
        });
      }
      if (!device && deviceId) {
        device = await localDb.getDeviceByQuery({
          connectId: deviceId,
          vendor: EHardwareVendor.trezor,
        });
        this._traceThp('persist.lookup', {
          lookupType: 'deviceIdAsConnectId',
          lookupValue: deviceId,
          found: Boolean(device),
          dbDevice: this._buildThpDebugDbDevice(device),
        });
      }
      if (!device) {
        await this._traceThpPersistMiss({ connectId, deviceId });
        // Record not created yet — keep buffered for flushThpCredentials().
        return;
      }
      await localDb.updateDeviceThpCredentials({
        dbDeviceId: device.id,
        credentials,
      });
      const updatedDevice = await localDb
        .getDevice(device.id)
        .catch(() => undefined);
      this._traceThp('persist.done', {
        connectId,
        deviceId,
        dbDeviceId: device.id,
        dbDevice: this._buildThpDebugDbDevice(updatedDevice),
      });
      for (const [key, value] of this._thpCredentialsByDevice) {
        if (value === credentials) {
          this._thpCredentialsByDevice.delete(key);
        }
      }
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] persisted THP credentials to device settings deviceId=${
          deviceId ?? '-'
        } connectId=${connectId ?? '-'}`,
      );
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] persist credentials failed: ${
          (error as Error)?.message ?? String(error)
        }`,
      );
    }
  }

  async searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]> {
    const startedAt = Date.now();
    if (options?.resetSession) {
      (
        this.hw as IHardwareWallet & {
          resetState?: () => void;
        }
      ).resetState?.();
    }
    try {
      this._searchDevicesDepth += 1;
      const devices = await (
        this.hw as IHardwareWallet & {
          searchDevices(
            options?: IThirdPartyHardwareSearchOptions,
          ): Promise<DeviceInfo[]>;
        }
      ).searchDevices(options);
      const filteredDevices = options?.transportType
        ? devices.filter(
            (device) => device.connectionType === options.transportType,
          )
        : devices;
      if (filteredDevices.length !== devices.length) {
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW][Trezor] searchDevices.filtered ${stringifyTrezorSearchDebugValue(
            {
              transportType: options?.transportType,
              rawCount: devices.length,
              filteredCount: filteredDevices.length,
              dropped: devices
                .filter(
                  (device) => device.connectionType !== options?.transportType,
                )
                .map(summarizeTrezorSearchDevice),
              kept: filteredDevices.map(summarizeTrezorSearchDevice),
            },
          )}`,
        );
      }
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] searchDevices -> count=${
          filteredDevices.length
        } durationMs=${Date.now() - startedAt}`,
      );
      return filteredDevices;
    } finally {
      this._searchDevicesDepth -= 1;
    }
  }

  async connectDevice(
    connectId: string,
  ): Promise<Response<IThirdPartyConnectedDevicePayload>> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] connectDevice connectId=${connectId}`,
    );
    void thirdPartyHardwareUiStateAtom.set({
      action: EThirdPartyHardwareUiAction.connecting,
      vendor: EHardwareVendor.trezor,
    });
    try {
      const result = await this.hw.connectDevice(connectId);
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] connectDevice result success=${String(result.success)}`,
      );
      if (!result.success) {
        let payloadStr = '';
        try {
          payloadStr = JSON.stringify(result.payload);
        } catch {
          payloadStr = String(result.payload);
        }
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW][Trezor] connectDevice FAILURE payload=${payloadStr}`,
        );
      }
      if (result.success) {
        const info = await this.hw.getDeviceInfo(connectId, result.payload);
        if (info.success) {
          const raw =
            (info.payload as DeviceInfo & { raw?: Record<string, unknown> })
              .raw || {};
          const features =
            (raw.features as Record<string, unknown> | undefined) || undefined;
          const featuresDeviceId =
            typeof features?.device_id === 'string'
              ? features.device_id
              : undefined;
          this._rememberConnectIdDeviceIdMapping({
            connectId,
            featuresDeviceId,
          });
          if (info.payload.connectId !== connectId) {
            this._rememberConnectIdDeviceIdMapping({
              connectId: info.payload.connectId,
              featuresDeviceId,
            });
          }
          let featuresModel: string | undefined;
          if (typeof features?.internal_model === 'string') {
            featuresModel = features.internal_model;
          } else if (typeof features?.model === 'string') {
            featuresModel = features.model;
          }
          const featuresModelName =
            typeof features?.model === 'string' ? features.model : undefined;
          const modelName = (
            info.payload as DeviceInfo & { modelName?: string }
          ).modelName;
          const payload = {
            connectId: info.payload.connectId || connectId,
            deviceId: featuresDeviceId || '',
            model: featuresModel || info.payload.model,
            modelName: modelName || featuresModelName,
            label: info.payload.label,
            firmwareVersion: info.payload.firmwareVersion,
            features,
            raw,
          };
          return {
            success: true,
            payload,
          };
        }
        return { success: false, payload: info.payload };
      }
      return { success: false, payload: result.payload };
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] connectDevice threw: ${
          (error as Error)?.message ?? String(error)
        }`,
      );
      throw error;
    } finally {
      void thirdPartyHardwareUiStateAtom.set(undefined);
    }
  }

  async disconnect(connectId: string): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] disconnect connectId=${connectId}`,
    );
    await this.hw.disconnectDevice(connectId);
  }

  async deviceSettings(
    connectId: string,
    params: TrezorDeviceSettingsParams,
  ): Promise<Response<Record<string, unknown>>> {
    const hw = this.hw as IHardwareWallet & ITrezorHardwareWalletExtensions;
    const deviceSettings = hw.deviceSettings;
    if (!deviceSettings) {
      return {
        success: false,
        payload: {
          code: HardwareErrorCode.MethodNotSupported,
          error: 'Trezor device settings are not supported',
        },
      };
    }
    return this._runWithProcessing(() => deviceSettings(connectId, params));
  }

  async setBrightness(
    connectId: string,
    params?: TrezorBrightnessParams,
  ): Promise<Response<Record<string, unknown>>> {
    const hw = this.hw as IHardwareWallet & ITrezorHardwareWalletExtensions;
    const setBrightness = hw.setBrightness;
    if (!setBrightness) {
      return {
        success: false,
        payload: {
          code: HardwareErrorCode.MethodNotSupported,
          error: 'Trezor brightness settings are not supported',
        },
      };
    }
    return this._runWithProcessing(() => setBrightness(connectId, params));
  }

  async changePin(
    connectId: string,
    params?: TrezorChangePinParams,
  ): Promise<Response<Record<string, unknown>>> {
    const hw = this.hw as IHardwareWallet & ITrezorHardwareWalletExtensions;
    const changePin = hw.changePin;
    if (!changePin) {
      return {
        success: false,
        payload: {
          code: HardwareErrorCode.MethodNotSupported,
          error: 'Trezor PIN settings are not supported',
        },
      };
    }
    return this._runWithProcessing(() => changePin(connectId, params));
  }

  async wipeDevice(
    connectId: string,
  ): Promise<Response<Record<string, unknown>>> {
    const hw = this.hw as IHardwareWallet & ITrezorHardwareWalletExtensions;
    const wipeDevice = hw.wipeDevice;
    if (!wipeDevice) {
      return {
        success: false,
        payload: {
          code: HardwareErrorCode.MethodNotSupported,
          error: 'Trezor wipe is not supported',
        },
      };
    }
    return this._runWithProcessing(() => wipeDevice(connectId));
  }

  reset(): void {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Trezor] reset()');
    this._processingDepth = 0;
    this._forceClearUiState();
    this._disposeSdkEvents?.();
    this._disposeSdkEvents = undefined;
    void this.hw.dispose();
  }
}

function summarizeTrezorSearchDevice(
  device: DeviceInfo,
): Record<string, unknown> {
  const extra = device as DeviceInfo & {
    name?: unknown;
    raw?: { transport?: unknown };
  };
  return {
    connectId: device.connectId,
    deviceId: device.deviceId,
    name: extra.name,
    model: device.model,
    connectionType: device.connectionType,
    rawTransport:
      typeof extra.raw?.transport === 'string'
        ? extra.raw.transport
        : undefined,
  };
}

function stringifyTrezorSearchDebugValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}
