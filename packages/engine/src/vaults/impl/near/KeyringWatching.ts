/* eslint-disable  @typescript-eslint/no-unused-vars */
import { OneKeyInternalError } from '../../../errors';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

import type { ISignCredentialOptions } from '../../../types/vault';

export class KeyringWatching extends KeyringWatchingBase {
  signTransaction(): Promise<any> {
    throw new OneKeyInternalError('Watching account can not signTransaction');
  }

  signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }

  prepareAccounts(params: any): Promise<Array<any>> {
    throw new OneKeyInternalError('prepareAccounts is not implemented');
  }
}
