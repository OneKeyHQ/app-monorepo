import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IHardwareHomeScreenData } from './hardwareHomeScreenData';

class UploadedHomeScreenCache {
  cache: Partial<{
    [dbDeviceId: string]: {
      data?: IHardwareHomeScreenData[];
    };
  }> = {};

  saveCache(dbDeviceId: string, data: IHardwareHomeScreenData) {
    this.delayedClear();
    if (!dbDeviceId) {
      return;
    }
    this.cache[dbDeviceId] = this.cache[dbDeviceId] || {
      data: [],
    };
    const dataArray = this?.cache?.[dbDeviceId]?.data;
    if (dataArray) {
      dataArray.push(data);
    }
  }

  getCacheList(dbDeviceId: string) {
    this.delayedClear();
    if (!dbDeviceId) {
      return [];
    }
    return this.cache?.[dbDeviceId]?.data || [];
  }

  clearTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  delayedClear() {
    clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(
      () => {
        this.cache = {};
      },
      timerUtils.getTimeDurationMs({
        minute: 10,
      }),
    );
  }
}

export default new UploadedHomeScreenCache();
