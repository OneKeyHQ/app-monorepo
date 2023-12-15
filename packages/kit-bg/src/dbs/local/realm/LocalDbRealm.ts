import { LocalDbRealmBase } from './LocalDbRealmBase';

export class LocalDbRealm extends LocalDbRealmBase {
  reset(): Promise<void> {
    return this.deleteDb();
  }
}
