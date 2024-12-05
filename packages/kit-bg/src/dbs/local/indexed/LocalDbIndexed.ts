/* eslint-disable @typescript-eslint/no-unused-vars */

import { ELocalDBStoreNames } from '../localDBStoreNames';

import { LocalDbIndexedBase } from './LocalDbIndexedBase';

export class LocalDbIndexed extends LocalDbIndexedBase {
  async reset(): Promise<void> {
    this.clearStoreCachedData(ELocalDBStoreNames.IndexedAccount);
    return this.deleteIndexedDb();
  }
}
