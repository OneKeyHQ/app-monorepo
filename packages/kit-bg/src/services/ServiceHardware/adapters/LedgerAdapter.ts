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
  IConnector,
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

  private _connector: IConnector;

  constructor(hw: IHardwareWallet, connector: IConnector) {
    super();
    this.hw = hw;
    this._connector = connector;

    // Whitelist known ui-event types; unknown ones log-only.
    this._connector.on('ui-event', (event) => {
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
          const unknownType = (event as { type?: string }).type ?? 'unknown';
          defaultLogger.hardware.sdkLog.log(
            `[LedgerAdapter] Unhandled SDK ui-event type: ${unknownType}`,
          );
          break;
        }
      }
    });

    this.hw.on('ui-request-button', () => {
      void thirdPartyHardwareUiStateAtom.set({
        action: EThirdPartyHardwareUiAction.confirmOnDevice,
        vendor: EHardwareVendor.ledger,
      });
    });

    this.hw.on(UI_REQUEST.REQUEST_DEVICE_CONNECT, () => {
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
    return this.hw.searchDevices();
  }

  async connectDevice(
    connectId: string,
  ): Promise<Response<{ connectId: string; deviceId: string }>> {
    void thirdPartyHardwareUiStateAtom.set({
      action: EThirdPartyHardwareUiAction.searching,
      vendor: EHardwareVendor.ledger,
    });
    try {
      const result = await this.hw.connectDevice(connectId);
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
      // Ensure atom is cleared on unexpected errors
      void thirdPartyHardwareUiStateAtom.set(undefined);
      throw error;
    }
  }

  async disconnect(connectId: string): Promise<void> {
    await this.hw.disconnectDevice(connectId);
  }

  reset(): void {
    void thirdPartyHardwareUiStateAtom.set(undefined);
    void this.hw.dispose();
  }
}
