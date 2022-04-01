import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

export class KeyringImported extends KeyringImportedBase {
  signTransaction(): Promise<any> {
    return Promise.resolve(undefined);
  }
}
