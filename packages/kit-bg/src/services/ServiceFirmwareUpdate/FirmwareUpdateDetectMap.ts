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
    this.firstDetectAt = Date.now();
  }

  firstDetectAt: number;

  backgroundApi: IBackgroundApi;

  detectMapCache: IFirmwareUpdatesDetectMap = {};

  detectTimeSpan = timerUtils.getTimeDurationMs({ minute: 5 });

  firstDetectTimeSpan = timerUtils.getTimeDurationMs({ minute: 1 });

  private showDebugToast(message: string) {
    void this.backgroundApi.serviceDevSetting
      .getFirmwareUpdateDevSettings('showAutoCheckHardwareUpdatesToast')
      .then((result) => {
        if (!result) return;

        void this.backgroundApi.serviceApp.showToast({
          method: 'message',
          title: message,
        });
      })
      .catch(() => {
        // ignore
      });
  }

  shouldDetect({ connectId }: { connectId: string }) {
    const now = Date.now();

    // Check is not allowed until one minute after the app is started
    if (now - this.firstDetectAt < this.firstDetectTimeSpan) {
      console.log(`skip detectFirmwareUpdates with first check: ${connectId}`);

      this.showDebugToast('刚启动 App，跳过检查更新');

      return false;
    }

    const lastDetectResult = this.detectMapCache[connectId];
    if (
      lastDetectResult?.lastDetectAt &&
      now - lastDetectResult.lastDetectAt < this.detectTimeSpan
    ) {
      console.log(`skip detectFirmwareUpdates: ${connectId}`);

      this.showDebugToast('刚刚检查过，跳过检查更新');
      return false;
    }

    this.showDebugToast('开始检查更新');
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
