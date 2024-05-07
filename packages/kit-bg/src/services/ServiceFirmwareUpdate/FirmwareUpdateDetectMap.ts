import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBleFirmwareUpdateInfo,
  IFirmwareUpdateInfo,
  IFirmwareUpdatesDetectMap,
  IFirmwareUpdatesDetectStatus,
} from '@onekeyhq/shared/types/device';

import { firmwareUpdatesDetectStatusAtom } from '../../states/jotai/atoms';

import { MOCK_ALL_IS_UP_TO_DATE } from './firmwareUpdateConsts';

export class FirmwareUpdateDetectMap {
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

  async updateDetectStatusAtom({ connectId }: { connectId: string }) {
    await firmwareUpdatesDetectStatusAtom.set(
      (value: IFirmwareUpdatesDetectStatus | undefined) => {
        const detectCache = this.detectMapCache[connectId];
        if (detectCache) {
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
            },
          };
          return newValue;
        }
        if (value && !detectCache) {
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
    if (!MOCK_ALL_IS_UP_TO_DATE) {
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
    if (!MOCK_ALL_IS_UP_TO_DATE) {
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
    delete this.detectMapCache[connectId];
    await this.updateDetectStatusAtom({
      connectId,
    });
  }
}
