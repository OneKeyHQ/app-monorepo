import { isNil, isString } from 'lodash';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

const SIMPLE_DB_KEY_PREFIX = 'simple_db';

abstract class SimpleDbEntityBase<T> {
  abstract readonly entityName: string;

  readonly enableCache: boolean = true;

  get entityKey() {
    return `${SIMPLE_DB_KEY_PREFIX}:${this.entityName}`;
  }

  // localStorage.getItem may return null if data not exists
  cachedRawData: T | undefined | null;

  clearRawDataCache() {
    this.cachedRawData = null;
  }

  async getRawData(): Promise<T | undefined | null> {
    if (this.enableCache && !isNil(this.cachedRawData)) {
      return Promise.resolve(this.cachedRawData);
    }
    const dataStr = await appStorage.getItem(this.entityKey);
    // @ts-ignore
    let data: T | undefined | null;
    if (isString(dataStr)) {
      try {
        data = JSON.parse(dataStr);
      } catch (err) {
        console.error(err);
        data = null;
      }
    } else {
      data = dataStr as any;
    }
    if (this.enableCache) {
      this.cachedRawData = data;
    }
    return data;
  }

  async setRawData(data: T) {
    if (this.enableCache) {
      this.cachedRawData = data;
    }
    await appStorage.setItem(this.entityKey, JSON.stringify(data));
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
