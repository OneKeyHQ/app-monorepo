import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
} from 'expo-file-system/legacy';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IDeviceHomeScreen } from '@onekeyhq/shared/types/device';

class UploadedHomeScreenCache {
  private originalImageDownloads = new Map<string, Promise<string>>();

  async getOriginalImageUri(url: string | undefined) {
    if (!platformEnv.isNative || !url || !/^https?:\/\//iu.test(url)) {
      return url;
    }
    const pending = this.originalImageDownloads.get(url);
    if (pending) return pending;

    const download = (async () => {
      if (!cacheDirectory) {
        throw new OneKeyLocalError('Wallpaper cache directory is unavailable');
      }
      const directory = `${cacheDirectory}hardware-wallpapers/`;
      const key = bytesToHex(sha256(new Uint8Array(Buffer.from(url, 'utf8'))));
      const uri = `${directory}${key}.img`;
      const info = await getInfoAsync(uri);
      if (info.exists && !info.isDirectory && info.size > 0) {
        return uri;
      }
      if (info.exists) {
        await deleteAsync(uri, { idempotent: true });
      }
      await makeDirectoryAsync(directory, { intermediates: true });
      const temporaryUri = `${uri}.${generateUUID()}.part`;
      try {
        const result = await downloadAsync(url, temporaryUri);
        const downloaded = await getInfoAsync(temporaryUri);
        if (
          result.status !== 200 ||
          !downloaded.exists ||
          downloaded.isDirectory ||
          downloaded.size <= 0
        ) {
          throw new OneKeyLocalError('Wallpaper download did not complete');
        }
        // Publish only complete files; the OS may evict this cache at any time.
        await moveAsync({ from: temporaryUri, to: uri });
        return uri;
      } catch (error) {
        await deleteAsync(temporaryUri, { idempotent: true }).catch(
          () => undefined,
        );
        throw error;
      }
    })();
    this.originalImageDownloads.set(url, download);
    try {
      return await download;
    } finally {
      this.originalImageDownloads.delete(url);
    }
  }

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
