import { ELocalDBStoreNames } from '../localDBStoreNames';

import { LocalDbRealmBase } from './LocalDbRealmBase';

export class LocalDbRealm extends LocalDbRealmBase {
  reset(): Promise<void> {
    this.clearStoreCachedData(ELocalDBStoreNames.IndexedAccount);
    return this.deleteDb();
  }
}
