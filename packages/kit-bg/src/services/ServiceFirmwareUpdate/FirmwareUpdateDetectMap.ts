import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBleFirmwareUpdateInfo,
  IFirmwareUpdateDetectStatus,
  IFirmwareUpdateDetectStatusSnapshot,
  IFirmwareUpdateInfo,
  IFirmwareUpdatesDetectMap,
  IFirmwareUpdatesDetectStatus,
} from '@onekeyhq/shared/types/device';

import { firmwareUpdatesDetectStatusPersistAtom } from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export class FirmwareUpdateDetectMap {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
    this.firstDetectAt = Date.now();
  }

  firstDetectAt: number;

  backgroundApi: IBackgroundApi;

  detectMapCache: IFirmwareUpdatesDetectMap = {};

  detectTimeSpan = timerUtils.getTimeDurationMs({ minute: 5 });

  firstDetectTimeSpan = timerUtils.getTimeDurationMs({ minute: 1 });

  getNextDetectDelay({ connectId }: { connectId: string }) {
    const now = Date.now();
    const firstDetectDelay =
      this.firstDetectTimeSpan - (now - this.firstDetectAt);
    const lastDetectAt = this.detectMapCache[connectId]?.lastDetectAt;
    const repeatedDetectDelay = lastDetectAt
      ? this.detectTimeSpan - (now - lastDetectAt)
      : 0;

    return Math.max(0, firstDetectDelay, repeatedDetectDelay);
  }

  shouldDetect({ connectId }: { connectId: string }) {
    const now = Date.now();

    // Check is not allowed until one minute after the app is started
    if (now - this.firstDetectAt < this.firstDetectTimeSpan) {
      void this.backgroundApi.serviceFirmwareUpdate.showAutoUpdateCheckDebugToast(
        '刚启动 App，跳过检查更新',
      );

      return false;
    }

    const lastDetectResult = this.detectMapCache[connectId];
    if (
      lastDetectResult?.lastDetectAt &&
      now - lastDetectResult.lastDetectAt < this.detectTimeSpan
    ) {
      void this.backgroundApi.serviceFirmwareUpdate.showAutoUpdateCheckDebugToast(
        '刚刚检查过，跳过检查更新',
      );
      return false;
    }

    void this.backgroundApi.serviceFirmwareUpdate.showAutoUpdateCheckDebugToast(
      '开始检查更新',
    );
    return true;
  }

  updateLastDetectAt({ connectId }: { connectId: string }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: Date.now(),
    };
  }

  updateLastDetectAtWithDelay({
    connectId,
    delay,
  }: {
    connectId: string;
    delay: number;
  }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: Date.now() + delay,
    };
  }

  resetLastDetectAt({ connectId }: { connectId: string }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: 0,
    };
  }

  private buildDetectStatus({
    connectId,
    detectCache,
  }: {
    connectId: string;
    detectCache: IFirmwareUpdatesDetectMap[string];
  }): IFirmwareUpdateDetectStatus | undefined {
    const updateInfo = detectCache?.updateInfo;
    if (!updateInfo) {
      return undefined;
    }
    return {
      connectId,
      hasUpgrade: Boolean(
        updateInfo.firmware?.hasUpgrade || updateInfo.ble?.hasUpgrade,
      ),
      toVersion: updateInfo.firmware?.hasUpgrade
        ? updateInfo.firmware.toVersion
        : undefined,
      toFirmwareType: updateInfo.firmware?.hasUpgrade
        ? updateInfo.firmware.toFirmwareType
        : undefined,
      toVersionBle: updateInfo.ble?.hasUpgrade
        ? updateInfo.ble.toVersion
        : undefined,
    };
  }

  getDetectStatus({
    connectId,
  }: {
    connectId: string;
  }): IFirmwareUpdateDetectStatusSnapshot {
    const detectCache = this.detectMapCache[connectId];
    return {
      requestedConnectId: connectId,
      resolved: detectCache?.detectResultResolved === true,
      status: this.buildDetectStatus({ connectId, detectCache }),
    };
  }

  async updateDetectStatusAtom({
    connectId,
    usbConnectId,
    bleConnectId,
  }: {
    connectId: string;
    usbConnectId?: string | null;
    bleConnectId?: string | null;
  }) {
    const staleConnectIds = [usbConnectId, bleConnectId].filter(
      (value): value is string => Boolean(value && value !== connectId),
    );
    for (const staleConnectId of staleConnectIds) {
      delete this.detectMapCache[staleConnectId];
    }
    const detectCache = this.detectMapCache[connectId];
    if (detectCache?.detectResultResolved !== true) {
      return;
    }
    await firmwareUpdatesDetectStatusPersistAtom.set(
      (value: IFirmwareUpdatesDetectStatus | undefined) => {
        const status = this.buildDetectStatus({ connectId, detectCache });
        const newValue = { ...value };
        for (const staleConnectId of staleConnectIds) {
          delete newValue[staleConnectId];
        }
        if (status) {
          newValue[connectId] = status;
        } else {
          delete newValue[connectId];
        }
        return Object.keys(newValue).length ? newValue : undefined;
      },
    );
    appEventBus.emit(
      EAppEventBusNames.FirmwareUpdateDetectStatusChanged,
      undefined,
    );
  }

  async updateFirmwareUpdateInfo({
    connectId,
    usbConnectId,
    bleConnectId,
    updateInfo,
  }: {
    connectId: string;
    usbConnectId?: string | null;
    bleConnectId?: string | null;
    updateInfo: IFirmwareUpdateInfo;
  }) {
    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    if (!mockAllIsUpToDate) {
      this.detectMapCache[connectId] = {
        ...this.detectMapCache[connectId],
        detectResultResolved: true,
        updateInfo: {
          ...this.detectMapCache[connectId]?.updateInfo,
          firmware: updateInfo,
        },
      };
    } else {
      this.detectMapCache[connectId] = {
        ...this.detectMapCache[connectId],
        detectResultResolved: true,
        updateInfo: undefined,
      };
    }
    await this.updateDetectStatusAtom({
      connectId,
      usbConnectId,
      bleConnectId,
    });
  }

  async updateBleFirmwareUpdateInfo({
    connectId,
    usbConnectId,
    bleConnectId,
    updateInfo,
  }: {
    connectId: string;
    usbConnectId?: string | null;
    bleConnectId?: string | null;
    updateInfo: IBleFirmwareUpdateInfo;
  }) {
    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    if (!mockAllIsUpToDate) {
      this.detectMapCache[connectId] = {
        ...this.detectMapCache[connectId],
        detectResultResolved: true,
        updateInfo: {
          ...this.detectMapCache[connectId]?.updateInfo,
          ble: updateInfo,
        },
      };
    } else {
      this.detectMapCache[connectId] = {
        ...this.detectMapCache[connectId],
        detectResultResolved: true,
        updateInfo: undefined,
      };
    }
    await this.updateDetectStatusAtom({
      connectId,
      usbConnectId,
      bleConnectId,
    });
  }

  async resolveUpdateInfo({
    connectId,
    usbConnectId,
    bleConnectId,
    firmware,
    ble,
  }: {
    connectId: string;
    usbConnectId?: string | null;
    bleConnectId?: string | null;
    firmware?: IFirmwareUpdateInfo;
    ble?: IBleFirmwareUpdateInfo;
  }) {
    const hasUpgrade = Boolean(firmware?.hasUpgrade || ble?.hasUpgrade);
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      detectResultResolved: true,
      updateInfo: hasUpgrade
        ? {
            firmware,
            ble,
          }
        : undefined,
    };
    await this.updateDetectStatusAtom({
      connectId,
      usbConnectId,
      bleConnectId,
    });
  }

  async deleteUpdateInfo({
    connectId,
    usbConnectId,
    bleConnectId,
  }: {
    connectId: string;
    usbConnectId?: string | null;
    bleConnectId?: string | null;
  }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      detectResultResolved: true,
      updateInfo: undefined,
    };
    await this.updateDetectStatusAtom({
      connectId,
      usbConnectId,
      bleConnectId,
    });
  }

  async clear() {
    this.detectMapCache = {};
    await firmwareUpdatesDetectStatusPersistAtom.set(undefined);
    appEventBus.emit(
      EAppEventBusNames.FirmwareUpdateDetectStatusChanged,
      undefined,
    );
  }
}
