import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IDeviceHomeScreen } from '@onekeyhq/shared/types/device';

class UploadedHomeScreenCache {
  cache: Partial<{
    [dbDeviceId: string]: {
      data?: IDeviceHomeScreen[];
    };
  }> = {};

  saveCache(dbDeviceId: string, data: IDeviceHomeScreen) {
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

  removeCache(dbDeviceId: string, id: string) {
    this.delayedClear();
    if (!dbDeviceId) {
      return;
    }
    const data = this.cache[dbDeviceId]?.data;
    if (data) {
      this.cache[dbDeviceId] = {
        data: data.filter((item) => item.name !== id),
      };
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
