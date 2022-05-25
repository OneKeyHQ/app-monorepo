import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

import { OneKeyInternalError } from '../../../errors';
import * as OneKeyHardware from '../../../hardware';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { ISignCredentialOptions } from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<any> {
    const path = await this.getAccountPath();
    return OneKeyHardware.nearSignTransaction(path, unsignedTx);
  }

  signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prepareAccounts(params: any): Promise<Array<any>> {
    throw new OneKeyInternalError('prepareAccounts is not implemented');
  }
}
