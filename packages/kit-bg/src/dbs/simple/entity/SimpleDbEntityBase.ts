import { Mutex } from 'async-mutex';
import { isFunction, isNil, isString } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

const SIMPLE_DB_KEY_PREFIX = 'simple_db';

type ISimpleDbEntitySavedData<T> = {
  data: T;
  updatedAt: number;
};
abstract class SimpleDbEntityBase<T> {
  mutex = new Mutex();

  abstract readonly entityName: string;

  readonly enableCache: boolean = true;

  get entityKey() {
    return `${SIMPLE_DB_KEY_PREFIX}:${this.entityName}`;
  }

  // localStorage.getItem may return null if data not exists
  cachedRawData: T | undefined | null;

  updatedAt = 0;

  @backgroundMethod()
  clearRawDataCache() {
    this.cachedRawData = null;
  }

  @backgroundMethod()
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

  @backgroundMethod()
  async setRawData(
    dataOrBuilder:
      | T
      | ((options: { rawData: T | null | undefined }) => T)
      | ((options: { rawData: T | null | undefined }) => Promise<T>),
  ) {
    return this.mutex.runExclusive(async () => {
      const updatedAt = Date.now();
      let data: T | undefined;

      if (isFunction(dataOrBuilder)) {
        const rawData = await this.getRawData();
        data = await dataOrBuilder({ rawData });
      } else {
        data = dataOrBuilder;
      }

      if (this.enableCache) {
        this.cachedRawData = data;
      }
      const savedData: ISimpleDbEntitySavedData<T> = {
        data,
        updatedAt,
      };
      await appStorage.setItem(this.entityKey, JSON.stringify(savedData));
      this.updatedAt = updatedAt;
      return data;
    });
  }

  @backgroundMethod()
  async clearRawData() {
    if (this.enableCache) {
      this.clearRawDataCache();
    }
    return appStorage.removeItem(this.entityKey);
  }
}
export { SimpleDbEntityBase };
