import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBleFirmwareUpdateInfo,
  IFirmwareUpdateInfo,
  IFirmwareUpdatesDetectMap,
  IFirmwareUpdatesDetectStatus,
} from '@onekeyhq/shared/types/device';

import { firmwareUpdatesDetectStatusAtom } from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export class FirmwareUpdateDetectMap {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  detectMapCache: IFirmwareUpdatesDetectMap = {};

  detectTimeSpan = timerUtils.getTimeDurationMs({ minute: 5 });

  shouldDetect({ connectId }: { connectId: string }) {
    const now = Date.now();
    const lastDetectResult = this.detectMapCache[connectId];
    if (
      lastDetectResult?.lastDetectAt &&
      now - lastDetectResult.lastDetectAt < this.detectTimeSpan
    ) {
      console.log(`skip detectFirmwareUpdates: ${connectId}`);
      return false;
    }
    return true;
  }

  updateLastDetectAt({ connectId }: { connectId: string }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: Date.now(),
    };
  }

  resetLastDetectAt({ connectId }: { connectId: string }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: 0,
    };
  }

  async updateDetectStatusAtom({ connectId }: { connectId: string }) {
    await firmwareUpdatesDetectStatusAtom.set(
      (value: IFirmwareUpdatesDetectStatus | undefined) => {
        const detectCache = this.detectMapCache[connectId];
        const hasUpdateInfo = detectCache && detectCache?.updateInfo;
        if (hasUpdateInfo) {
          const hasUpgrade = Boolean(
            detectCache?.updateInfo?.firmware?.hasUpgrade ||
              detectCache?.updateInfo?.ble?.hasUpgrade,
          );
          const newValue: IFirmwareUpdatesDetectStatus = {
            ...value,
            [connectId]: {
              ...value?.[connectId],
              hasUpgrade,
              connectId,
              toVersion:
                detectCache?.updateInfo?.firmware?.toVersion ??
                value?.[connectId]?.toVersion,
              toVersionBle:
                detectCache?.updateInfo?.ble?.toVersion ??
                value?.[connectId]?.toVersionBle,
            },
          };
          return newValue;
        }
        if (value && !hasUpdateInfo) {
          delete value[connectId];
          return { ...value };
        }
        return value;
      },
    );
  }

  async updateFirmwareUpdateInfo({
    connectId,
    updateInfo,
  }: {
    connectId: string;
    updateInfo: IFirmwareUpdateInfo;
  }) {
    console.log('updateFirmwareUpdateInfo', { connectId, updateInfo });
    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    if (!mockAllIsUpToDate) {
      this.detectMapCache[connectId] = {
        ...this.detectMapCache[connectId],
        updateInfo: {
          ...this.detectMapCache[connectId]?.updateInfo,
          firmware: updateInfo,
        },
      };
    }
    await this.updateDetectStatusAtom({
      connectId,
    });
  }

  async updateBleFirmwareUpdateInfo({
    connectId,
    updateInfo,
  }: {
    connectId: string;
    updateInfo: IBleFirmwareUpdateInfo;
  }) {
    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    if (!mockAllIsUpToDate) {
      this.detectMapCache[connectId] = {
        ...this.detectMapCache[connectId],
        updateInfo: {
          ...this.detectMapCache[connectId]?.updateInfo,
          ble: updateInfo,
        },
      };
    }
    await this.updateDetectStatusAtom({
      connectId,
    });
  }

  async deleteUpdateInfo({ connectId }: { connectId: string }) {
    // delete this.detectMapCache[connectId];
    const cache = this.detectMapCache[connectId];
    if (cache) {
      // keep lastDetectAt but clear updateInfo
      cache.updateInfo = undefined;
    }
    await this.updateDetectStatusAtom({
      connectId,
    });
  }
}
