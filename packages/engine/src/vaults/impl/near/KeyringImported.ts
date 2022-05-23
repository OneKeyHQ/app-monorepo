/* eslint-disable  @typescript-eslint/no-unused-vars */
import { OneKeyInternalError } from '../../../errors';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import type { ISignCredentialOptions } from '../../../types/vault';

export class KeyringImported extends KeyringImportedBase {
  override signTransaction(): Promise<any> {
    return Promise.resolve(undefined);
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }

  prepareAccounts(params: any): Promise<Array<any>> {
    throw new OneKeyInternalError('prepareAccounts is not implemented');
  }

  getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, any>> {
    throw new OneKeyInternalError('getSigners is not implemented');
  }
}
