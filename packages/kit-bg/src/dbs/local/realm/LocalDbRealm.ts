import { LocalDbRealmBase } from './LocalDbRealmBase';

export class LocalDbRealm extends LocalDbRealmBase {
  reset(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
