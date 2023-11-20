import { isNil, isString } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

const SIMPLE_DB_KEY_PREFIX = 'simple_db';

type ISimpleDbEntitySavedData<T> = {
  data: T;
  updatedAt: number;
};
abstract class SimpleDbEntityBase<T> {
  abstract readonly entityName: string;

  readonly enableCache: boolean = true;

  get entityKey() {
    return `${SIMPLE_DB_KEY_PREFIX}:${this.entityName}`;
  }

  // localStorage.getItem may return null if data not exists
  cachedRawData: T | undefined | null;

  updatedAt = 0;

  clearRawDataCache() {
    this.cachedRawData = null;
  }

  async getRawData(): Promise<T | undefined | null> {
    if (this.enableCache && !isNil(this.cachedRawData)) {
      return Promise.resolve(this.cachedRawData);
    }
    const savedDataStr = await appStorage.getItem(this.entityKey);
    let updatedAt = 0;
    // @ts-ignore
    let data: T | undefined | null;
    if (isString(savedDataStr)) {
      try {
        const savedData = JSON.parse(
          savedDataStr,
        ) as ISimpleDbEntitySavedData<T>;
        data = savedData?.data;
        updatedAt = savedData?.updatedAt;
      } catch (err) {
        console.error(err);
        data = null;
      }
    } else {
      data = savedDataStr as any;
    }
    if (this.enableCache) {
      this.cachedRawData = data;
    }
    this.updatedAt = updatedAt ?? 0;
    return data;
  }

  async setRawData(data: T) {
    const updatedAt = Date.now();
    if (this.enableCache) {
      this.cachedRawData = data;
    }
    const savedData: ISimpleDbEntitySavedData<T> = {
      data,
      updatedAt,
    };
    if (platformEnv.isDev && platformEnv.isDesktop) {
      Object.assign(savedData, {
        _tmpUpdatedAtText: new Date(updatedAt).toLocaleString(),
      });
    }
    await appStorage.setItem(this.entityKey, JSON.stringify(savedData));
    this.updatedAt = updatedAt ?? 0;
    return data;
  }

  async clearRawData() {
    if (this.enableCache) {
      this.clearRawDataCache();
    }
    return appStorage.removeItem(this.entityKey);
  }
}
export { SimpleDbEntityBase };
