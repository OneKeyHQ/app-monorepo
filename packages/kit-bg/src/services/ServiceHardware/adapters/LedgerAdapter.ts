import { EConnectorInteraction, UI_REQUEST } from '@onekeyfe/hwk-adapter-core';

import {
  EThirdPartyHardwareUiAction,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { BaseAdapter } from './BaseAdapter';

import type {
  DeviceInfo,
  IHardwareWallet,
  IThirdPartyHardwareAdapter,
  Response,
} from './types';

export class LedgerAdapter
  extends BaseAdapter
  implements IThirdPartyHardwareAdapter
{
  readonly vendor = EHardwareVendor.ledger;

  readonly hw: IHardwareWallet;

  constructor(hw: IHardwareWallet) {
    super();
    this.hw = hw;
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] adapter created');

    // Whitelist known ui-event types; unknown ones log-only.
    this.hw.on('ui-event', (event) => {
      const eventType = (event as { type?: string }).type ?? 'unknown';
      defaultLogger.hardware.sdkLog.uiEvent(
        `[3rdPartyHW][Ledger] ${eventType}`,
        event,
      );
      switch (event.type) {
        case EConnectorInteraction.ConfirmOpenApp:
          void thirdPartyHardwareUiStateAtom.set({
            action: EThirdPartyHardwareUiAction.openApp,
            vendor: EHardwareVendor.ledger,
          });
          break;
        case EConnectorInteraction.UnlockDevice:
          void thirdPartyHardwareUiStateAtom.set({
            action: EThirdPartyHardwareUiAction.unlockDevice,
            vendor: EHardwareVendor.ledger,
          });
          break;
        case EConnectorInteraction.ConfirmOnDevice:
          void thirdPartyHardwareUiStateAtom.set({
            action: EThirdPartyHardwareUiAction.confirmOnDevice,
            vendor: EHardwareVendor.ledger,
          });
          break;
        case EConnectorInteraction.InteractionComplete:
          void thirdPartyHardwareUiStateAtom.set(undefined);
          break;
        default: {
          defaultLogger.hardware.sdkLog.log(
            `[3rdPartyHW][Ledger] Unhandled SDK ui-event type: ${eventType}`,
          );
          break;
        }
      }
    });

    this.hw.on(UI_REQUEST.REQUEST_DEVICE_CONNECT, () => {
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW][Ledger] REQUEST_DEVICE_CONNECT',
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestUnlock,
        payload: {
          message: appLocale.intl.formatMessage({
            id: ETranslations.hardware_third_party_connect_ledger_message,
          }),
        },
      });
    });

    // BaseAdapter's onUiEvent -> set atom for request events
    this.onUiEvent((event) => {
      if (event.kind === 'request') {
        void thirdPartyHardwareUiStateAtom.set({
          action: event.type as EThirdPartyHardwareUiAction,
          vendor: EHardwareVendor.ledger,
          payload: event.payload,
        });
      }
    });
  }

  async searchDevices(): Promise<DeviceInfo[]> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] searchDevices()');
    const devices = await this.hw.searchDevices();
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Ledger] searchDevices -> count=${devices.length}`,
    );
    return devices;
  }

  async connectDevice(
    connectId: string,
  ): Promise<Response<{ connectId: string; deviceId: string }>> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Ledger] connectDevice connectId=${connectId}`,
    );
    void thirdPartyHardwareUiStateAtom.set({
      action: EThirdPartyHardwareUiAction.searching,
      vendor: EHardwareVendor.ledger,
    });
    try {
      const result = await this.hw.connectDevice(connectId);
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] connectDevice result success=${String(
          result.success,
        )}`,
      );
      if (result.success) {
        const info = await this.hw.getDeviceInfo(connectId, result.payload);
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW][Ledger] getDeviceInfo success=${String(info.success)}`,
        );
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
        `[3rdPartyHW][Ledger] connectDevice threw: ${
          (error as Error)?.message ?? String(error)
        }`,
      );
      // Ensure atom is cleared on unexpected errors
      void thirdPartyHardwareUiStateAtom.set(undefined);
      throw error;
    }
  }

  async disconnect(connectId: string): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Ledger] disconnect connectId=${connectId}`,
    );
    await this.hw.disconnectDevice(connectId);
  }

  reset(): void {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] reset()');
    void thirdPartyHardwareUiStateAtom.set(undefined);
    void this.hw.dispose();
  }
}
