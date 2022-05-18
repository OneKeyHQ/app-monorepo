import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import type { ISignCredentialOptions } from '../../../types/vault';

export class KeyringImported extends KeyringImportedBase {
  signTransaction(): Promise<any> {
    return Promise.resolve(undefined);
  }

  signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
