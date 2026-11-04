import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import { Platform, Image as RNImage } from 'react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IDeviceHomeScreen } from '@onekeyhq/shared/types/device';

const ORIGINAL_IMAGE_MAX_AGE_MS = timerUtils.getTimeDurationMs({ hour: 24 });
const ORIGINAL_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

class UploadedHomeScreenCache {
  private originalImageDownloads = new Map<string, Promise<string>>();

  private originalImageQueue: Promise<void> = Promise.resolve();

  private async pruneOriginalImages(
    directory: string,
    reservedBytes = 0,
    temporaryUri?: string,
  ) {
    const files: { uri: string; size: number; modificationTime: number }[] = [];
    let totalBytes = reservedBytes;
    for (const name of await readDirectoryAsync(directory)) {
      const uri = `${directory}${name}`;
      if (uri !== temporaryUri) {
        const info = await getInfoAsync(uri);
        if (info.exists && !info.isDirectory) {
          if (
            name.endsWith('.part') ||
            info.size <= 0 ||
            Date.now() - info.modificationTime * 1000 >=
              ORIGINAL_IMAGE_MAX_AGE_MS
          ) {
            await deleteAsync(uri, { idempotent: true });
          } else {
            totalBytes += info.size;
            files.push({
              uri,
              size: info.size,
              modificationTime: info.modificationTime,
            });
          }
        }
      }
    }
    files.sort((a, b) => a.modificationTime - b.modificationTime);
    for (const file of files) {
      if (totalBytes <= ORIGINAL_IMAGE_MAX_BYTES) break;
      await deleteAsync(file.uri, { idempotent: true });
      totalBytes -= file.size;
    }
  }

  private async validateOriginalImage(uri: string) {
    await new Promise<void>((resolve, reject) => {
      RNImage.getSize(
        uri,
        (width, height) => {
          if (width > 0 && height > 0) resolve();
          else reject(new OneKeyLocalError('Wallpaper image is invalid'));
        },
        reject,
      );
    });
  }

  async getOriginalImageUri(url: string | undefined) {
    if (
      !Platform.select({ native: true, default: false }) ||
      !url ||
      !/^https?:\/\//iu.test(url)
    ) {
      return url;
    }
    const pending = this.originalImageDownloads.get(url);
    if (pending) return pending;

    // Serialize native cache mutations so concurrent URLs cannot race eviction.
    const download = this.originalImageQueue.then(async () => {
      if (!cacheDirectory) {
        throw new OneKeyLocalError('Wallpaper cache directory is unavailable');
      }
      const directory = `${cacheDirectory}hardware-wallpapers/`;
      const key = bytesToHex(sha256(new Uint8Array(Buffer.from(url, 'utf8'))));
      const uri = `${directory}${key}.img`;
      await makeDirectoryAsync(directory, { intermediates: true });
      await this.pruneOriginalImages(directory);
      const info = await getInfoAsync(uri);
      if (info.exists && !info.isDirectory && info.size > 0) {
        try {
          await this.validateOriginalImage(uri);
          return uri;
        } catch {
          // Recover files cached before image validation, or corrupted on disk.
        }
      }
      if (info.exists) {
        await deleteAsync(uri, { idempotent: true });
      }
      const temporaryUri = `${uri}.${generateUUID()}.part`;
      try {
        const result = await downloadAsync(url, temporaryUri);
        const downloaded = await getInfoAsync(temporaryUri);
        if (
          result.status !== 200 ||
          !downloaded.exists ||
          downloaded.isDirectory ||
          downloaded.size <= 0 ||
          downloaded.size > ORIGINAL_IMAGE_MAX_BYTES
        ) {
          throw new OneKeyLocalError('Wallpaper download did not complete');
        }
        await this.validateOriginalImage(temporaryUri);
        await this.pruneOriginalImages(
          directory,
          downloaded.size,
          temporaryUri,
        );
        // Publish only complete files; the OS may evict this cache at any time.
        await moveAsync({ from: temporaryUri, to: uri });
        return uri;
      } catch (error) {
        await deleteAsync(temporaryUri, { idempotent: true }).catch(
          () => undefined,
        );
        throw error;
      }
    });
    this.originalImageQueue = download.then(
      () => undefined,
      () => undefined,
    );
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
