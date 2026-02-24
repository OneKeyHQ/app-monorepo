/* eslint-disable no-continue */
import fs from 'fs';
import path from 'path';

import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCheckServerStatusResult,
  ICloudSyncDownloadPostData,
  ICloudSyncDownloadResult,
  ICloudSyncServerItem,
  ICloudSyncServerItemByDownloaded,
  ICloudSyncUploadPostData,
  ICloudSyncUploadResult,
} from './types';

type ICheckStatusResult = {
  result: ICloudSyncCheckServerStatusResult;
  serverTime: string;
};

type IStorageData = Record<string, ICloudSyncServerItem[]>;

export class KeylessCloudSyncMockStore {
  private storageDir: string;

  private storageFilePath: string;

  constructor() {
    // 使用 .tmp 目录存储（已在 .gitignore 中）
    this.storageDir = path.resolve(__dirname, '../../../../../.tmp');
    this.storageFilePath = path.join(
      this.storageDir,
      'keyless-cloud-sync-mock-data.json',
    );
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadStorage(): IStorageData {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const content = fs.readFileSync(this.storageFilePath, 'utf-8');
        return JSON.parse(content) as IStorageData;
      }
    } catch (error) {
      console.error('[MockAPI] Failed to load storage:', error);
    }
    return {};
  }

  private saveStorage(data: IStorageData): void {
    try {
      fs.writeFileSync(
        this.storageFilePath,
        JSON.stringify(data, null, 2),
        'utf-8',
      );
    } catch (error) {
      console.error('[MockAPI] Failed to save storage:', error);
    }
  }

  private getStorageKey(publicKey: string): string {
    return `keyless_${publicKey.slice(0, 32)}`;
  }

  private async timeNow(): Promise<number> {
    return Date.now();
  }

  async upload(params: {
    publicKey: string;
    postData: ICloudSyncUploadPostData;
  }): Promise<ICloudSyncUploadResult> {
    const storage = this.loadStorage();
    const key = this.getStorageKey(params.publicKey);
    const existingItems = storage[key] ?? [];
    const itemMap = new Map(existingItems.map((item) => [item.key, item]));
    const items = params.postData.localData ?? [];
    let created = 0;
    let updated = 0;

    for (const newItem of items) {
      const existing = itemMap.get(newItem.key);
      if (existing) {
        existing.data = newItem.data;
        existing.dataTimestamp = newItem.dataTimestamp;
        existing.pwdHash = newItem.pwdHash;
        existing.isDeleted = newItem.isDeleted;
        updated += 1;
      } else {
        itemMap.set(newItem.key, newItem);
        created += 1;
      }
    }

    storage[key] = Array.from(itemMap.values());
    this.saveStorage(storage);
    console.log(
      '[MockAPI] Keyless upload success:',
      key,
      items.length,
      'items',
    );
    return {
      nonce: 0,
      created,
      updated,
    };
  }

  async checkStatus(params: {
    publicKey: string;
    postData: ICloudSyncCheckServerStatusPostData;
  }): Promise<ICheckStatusResult> {
    const storage = this.loadStorage();
    const key = this.getStorageKey(params.publicKey);
    const mockedServerItems = storage[key] ?? [];
    const onlyCheckLocalDataType = new Set(
      params.postData.onlyCheckLocalDataType,
    );
    const filteredLocalItems = params.postData.localData.filter((item) =>
      onlyCheckLocalDataType.has(item.dataType),
    );
    const serverItems = mockedServerItems.filter((item) =>
      onlyCheckLocalDataType.has(item.dataType),
    );

    const toKey = (item: { key: string; dataType: string }) =>
      `${item.dataType}:${item.key}`;
    const localMap = new Map(
      filteredLocalItems.map((item) => [toKey(item), item]),
    );
    const serverMap = new Map(serverItems.map((item) => [toKey(item), item]));

    const getLocalTime = (item: { dataTimestamp: number | undefined }) =>
      item.dataTimestamp ?? 0;
    const getServerTime = (item: ICloudSyncServerItem) =>
      item.dataTimestamp ?? 0;

    const obsoleted: string[] = [];
    const updated: ICloudSyncServerItem[] = [];
    const deleted: string[] = [];
    const diff: ICloudSyncServerItem[] = [];

    for (const localItem of filteredLocalItems) {
      const serverItem = serverMap.get(toKey(localItem));
      const localTime = getLocalTime(localItem);

      if (!serverItem) {
        obsoleted.push(localItem.key);
        continue;
      }

      const serverTime = getServerTime(serverItem);

      if (serverItem.isDeleted) {
        if (serverTime >= localTime) {
          deleted.push(serverItem.key);
        } else {
          obsoleted.push(localItem.key);
        }
        continue;
      }

      if (serverTime > localTime) {
        updated.push(serverItem);
      } else if (localTime > serverTime) {
        obsoleted.push(localItem.key);
      }
    }

    for (const serverItem of serverItems) {
      if (localMap.has(toKey(serverItem))) {
        continue;
      }
      if (serverItem.isDeleted) {
        deleted.push(serverItem.key);
      } else {
        updated.push(serverItem);
      }
    }

    return {
      result: {
        deleted,
        diff,
        updated,
        obsoleted,
        pwdHash: '',
        serverTime: await this.timeNow(),
      },
      serverTime: new Date().toISOString(),
    };
  }

  async download(params: {
    publicKey?: string;
    signatureHeader?: string;
    postData: ICloudSyncDownloadPostData;
  }): Promise<ICloudSyncDownloadResult> {
    if (!params.publicKey || !params.signatureHeader) {
      return {
        nonce: 0,
        serverData: [],
        pwdHash: '',
      };
    }

    const storage = this.loadStorage();
    const key = this.getStorageKey(params.publicKey);
    const serverData = storage[key] ?? [];
    const sliced = serverData.slice(
      params.postData.start ?? 0,
      params.postData.limit
        ? (params.postData.start ?? 0) + params.postData.limit
        : undefined,
    );
    const filtered = params.postData.includeDeleted
      ? sliced
      : sliced.filter((item) => !item.isDeleted);
    const now = await this.timeNow();
    const mapped: ICloudSyncServerItemByDownloaded[] = filtered.map((item) => ({
      ...item,
      dataTimestamp: item.dataTimestamp ?? now,
    }));
    return {
      nonce: 0,
      serverData: mapped,
      pwdHash: '',
    };
  }

  clear(): void {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        fs.unlinkSync(this.storageFilePath);
      }
      console.log('[MockAPI] Keyless storage cleared');
    } catch (error) {
      console.error('[MockAPI] Failed to clear storage:', error);
    }
  }
}
