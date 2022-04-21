import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

import * as OneKeyHardware from '../../../hardware';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { ISignCredentialOptions } from '../../../types/vault';

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<any> {
    const path = await this.getAccountPath();
    return OneKeyHardware.solanaSignTransaction(path, unsignedTx);
  }

  signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
