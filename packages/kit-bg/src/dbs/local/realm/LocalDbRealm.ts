import { LocalDbRealmBase } from './LocalDbRealmBase';

export class LocalDbRealm extends LocalDbRealmBase {
  reset(): Promise<void> {
    this.clearStoreCachedData();
    return this.deleteDb();
  }
}
