import { EConnectorInteraction, UI_REQUEST } from '@onekeyfe/hwk-adapter-core';

import {
  EThirdPartyHardwareUiAction,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
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

const APP_INSTALL_PROGRESS_LOG_INTERVAL_MS = 5000;
const APP_INSTALL_PROGRESS_LOG_STEP = 0.1;

type IAppInstallProgressLogState = {
  progress: number;
  loggedAt: number;
  completed: boolean;
};

export class LedgerAdapter
  extends BaseAdapter
  implements IThirdPartyHardwareAdapter
{
  readonly vendor = EHardwareVendor.ledger;

  readonly hw: IHardwareWallet;

  private readonly appInstallProgressLogState = new Map<
    string,
    IAppInstallProgressLogState
  >();

  constructor(hw: IHardwareWallet) {
    super();
    this.hw = hw;

    this.hw.on('ui-event', (event) => {
      const eventType = (event as { type?: string }).type ?? 'unknown';
      defaultLogger.hardware.sdkLog.uiEvent(
        `[3rdPartyHW][Ledger] ${eventType}`,
        event,
      );
      switch (event.type) {
        case EConnectorInteraction.Searching:
          void thirdPartyHardwareUiStateAtom.set({
            action: EThirdPartyHardwareUiAction.searching,
            vendor: EHardwareVendor.ledger,
          });
          break;
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

    this.hw.on(UI_REQUEST.REQUEST_DEVICE_CONNECT, (event) => {
      const { vendor, reason } = event.payload;
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] REQUEST_DEVICE_CONNECT vendor=${vendor} reason=${reason}`,
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestDeviceNotFound,
        payload: {
          vendor,
          reason,
          message: appLocale.intl.formatMessage({
            id: ETranslations.hardware_third_party_connect_ledger_message,
          }),
        },
      });
    });

    this.hw.on(UI_REQUEST.REQUEST_BTC_HIGH_INDEX_CONFIRM, (event) => {
      const { vendor, path, accountIndex } = event.payload;
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] REQUEST_BTC_HIGH_INDEX_CONFIRM path=${path} index=${accountIndex}`,
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm,
        payload: {
          vendor,
          path,
          accountIndex,
        },
      });
    });

    this.hw.on(UI_REQUEST.CLOSE_UI_WINDOW, () => {
      defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] CLOSE_UI_WINDOW');
      void thirdPartyHardwareUiStateAtom.set(undefined);
    });

    this.onUiEvent((event) => {
      if (event.kind === 'request') {
        const { reason, message, path, accountIndex } = event.payload ?? {};
        void thirdPartyHardwareUiStateAtom.set({
          action: event.type as EThirdPartyHardwareUiAction,
          vendor: EHardwareVendor.ledger,
          payload: { reason, message, path, accountIndex },
        });
      }
    });

    (
      this.hw as IHardwareWallet & {
        on(
          event: 'app-install-progress',
          listener: (e: {
            type: 'app-install-progress';
            payload: {
              connectId: string;
              appName: string;
              progress: number;
              requiredUserInteraction?: string;
            };
          }) => void,
        ): void;
      }
    ).on('app-install-progress', (event) => {
      const payload = event.payload;
      if (
        this.shouldLogAppInstallProgress({
          connectId: payload.connectId,
          appName: payload.appName,
          progress: payload.progress,
        })
      ) {
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW][Ledger] app-install-progress appName=${payload.appName} progress=${payload.progress}`,
        );
      }
      appEventBus.emit(EAppEventBusNames.ThirdPartyHardwareAppInstallProgress, {
        vendor: EHardwareVendor.ledger,
        connectId: payload.connectId,
        appName: payload.appName,
        progress: payload.progress,
        requiredUserInteraction: payload.requiredUserInteraction,
      });
    });
  }

  private shouldLogAppInstallProgress({
    connectId,
    appName,
    progress,
  }: {
    connectId: string;
    appName: string;
    progress: number;
  }) {
    const key = `${connectId || '(empty)'}:${appName}`;
    const now = Date.now();
    const previous = this.appInstallProgressLogState.get(key);
    if (previous?.completed && progress >= previous.progress) {
      return false;
    }
    const shouldLog =
      !previous ||
      progress < previous.progress ||
      progress >= 1 ||
      progress - previous.progress >= APP_INSTALL_PROGRESS_LOG_STEP ||
      now - previous.loggedAt >= APP_INSTALL_PROGRESS_LOG_INTERVAL_MS;

    if (shouldLog) {
      this.appInstallProgressLogState.set(key, {
        progress,
        loggedAt: now,
        completed: progress >= 1,
      });
    }
    return shouldLog;
  }

  async searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] searchDevices()');
    const devices = await (
      this.hw as IHardwareWallet & {
        searchDevices(
          options?: IThirdPartyHardwareSearchOptions,
        ): Promise<DeviceInfo[]>;
      }
    ).searchDevices(options);
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
