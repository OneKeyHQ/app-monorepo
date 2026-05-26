import { DEVICE, EConnectorInteraction, UI_REQUEST } from '@onekeyfe/hwk-adapter-core';

import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';
import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { BaseAdapter } from './BaseAdapter';

import type {
  DeviceInfo,
  IHardwareWallet,
  IThirdPartyHardwareAdapter,
  IThirdPartyHardwareSearchOptions,
  Response,
} from './types';

/**
 * Trezor third-party hardware adapter.
 *
 * The big shape difference from `LedgerAdapter`:
 *   - Trezor THP has a *blocking* UI step (CodeEntry pairing) — the SDK
 *     pauses until the user reads a code off the device screen and types
 *     it back. That's surfaced as `requestTrezorThpPairing` (Dialog with
 *     text input + Submit), not a passive toast.
 *   - Trezor mints pairing credentials on each first-time pair; we forward
 *     `DEVICE.TREZOR_THP_CREDENTIALS_CHANGED` to simpleDb so subsequent
 *     handshakes hit the autoconnect path. The connector self-mutates its
 *     in-memory array on the same event, so persisted creds and live
 *     state stay in sync without an extra setKnownCredentials roundtrip.
 *   - Trezor THP has no "open app" / "BTC high index" concepts — those
 *     branches are Ledger-only.
 */
export class TrezorAdapter
  extends BaseAdapter
  implements IThirdPartyHardwareAdapter
{
  readonly vendor = EHardwareVendor.trezor;

  readonly hw: IHardwareWallet;

  constructor(hw: IHardwareWallet) {
    super();
    this.hw = hw;
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
          void thirdPartyHardwareUiStateAtom.set({
            action: EThirdPartyHardwareUiAction.searching,
            vendor: EHardwareVendor.trezor,
          });
          break;
        case EConnectorInteraction.ConfirmOnDevice:
          void thirdPartyHardwareUiStateAtom.set({
            action: EThirdPartyHardwareUiAction.confirmOnDevice,
            vendor: EHardwareVendor.trezor,
          });
          break;
        case EConnectorInteraction.InteractionComplete:
          void thirdPartyHardwareUiStateAtom.set(undefined);
          break;
        default: {
          defaultLogger.hardware.sdkLog.log(
            `[3rdPartyHW][Trezor] Unhandled SDK ui-event type: ${eventType}`,
          );
          break;
        }
      }
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

    // THP lock — emitted as a REQUEST_BUTTON with code=ButtonRequest_PinEntry
    // by hwk-trezor-core when ThpDeviceLocked → tryToUnlock retry. Surface as
    // a toast; the SDK's THP read blocks on its own until the user enters
    // their PIN on device, no action needed from us.
    this.hw.on(UI_REQUEST.REQUEST_BUTTON, (event) => {
      const payload = event.payload as { code?: string };
      if (payload.code !== 'ButtonRequest_PinEntry') {
        // Generic confirm-on-device button request — already covered by
        // ui-event flow. Don't double-fire.
        return;
      }
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW][Trezor] REQUEST_BUTTON ButtonRequest_PinEntry',
      );
      void thirdPartyHardwareUiStateAtom.set({
        action: EThirdPartyHardwareUiAction.requestTrezorUnlock,
        vendor: EHardwareVendor.trezor,
      });
    });

    // Persistent credentials: the connector self-mutates its in-memory
    // knownCredentials array on this same event (auto-dedup). We mirror to
    // simpleDb so the next SW boot loads them via setKnownCredentials().
    this.hw.on(DEVICE.TREZOR_THP_CREDENTIALS_CHANGED, (event) => {
      const payload = event.payload as {
        connectId?: string;
        deviceId?: string;
        credentials: Record<string, unknown>[];
      };
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] THP_CREDENTIALS_CHANGED count=${payload.credentials.length} deviceId=${
          payload.deviceId ?? '-'
        }`,
      );
      void simpleDb.trezorThpCredentials
        .setCredentials(payload.credentials)
        .catch((error) => {
          defaultLogger.hardware.sdkLog.log(
            `[3rdPartyHW][Trezor] persist credentials failed: ${
              (error as Error)?.message ?? String(error)
            }`,
          );
        });
    });

    this.hw.on(UI_REQUEST.CLOSE_UI_WINDOW, () => {
      defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Trezor] CLOSE_UI_WINDOW');
      void thirdPartyHardwareUiStateAtom.set(undefined);
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

  async searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Trezor] searchDevices()');
    const devices = await (
      this.hw as IHardwareWallet & {
        searchDevices(
          options?: IThirdPartyHardwareSearchOptions,
        ): Promise<DeviceInfo[]>;
      }
    ).searchDevices(options);
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] searchDevices -> count=${devices.length}`,
    );
    return devices;
  }

  async connectDevice(
    connectId: string,
  ): Promise<Response<{ connectId: string; deviceId: string }>> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] connectDevice connectId=${connectId}`,
    );
    try {
      const result = await this.hw.connectDevice(connectId);
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] connectDevice result success=${String(result.success)}`,
      );
      if (result.success) {
        const info = await this.hw.getDeviceInfo(connectId, result.payload);
        void thirdPartyHardwareUiStateAtom.set(undefined);
        if (info.success) {
          return {
            success: true,
            payload: {
              connectId: info.payload.connectId,
              deviceId: info.payload.deviceId,
            },
          };
        }
        return { success: true, payload: { connectId, deviceId: connectId } };
      }
      void thirdPartyHardwareUiStateAtom.set(undefined);
      return { success: false, payload: result.payload };
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Trezor] connectDevice threw: ${
          (error as Error)?.message ?? String(error)
        }`,
      );
      void thirdPartyHardwareUiStateAtom.set(undefined);
      throw error;
    }
  }

  async disconnect(connectId: string): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Trezor] disconnect connectId=${connectId}`,
    );
    await this.hw.disconnectDevice(connectId);
  }

  reset(): void {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Trezor] reset()');
    void thirdPartyHardwareUiStateAtom.set(undefined);
    void this.hw.dispose();
  }
}

