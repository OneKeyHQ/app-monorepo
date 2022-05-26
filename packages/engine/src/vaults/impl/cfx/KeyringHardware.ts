import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

import { NotImplemented } from '../../../errors';
import * as OneKeyHardware from '../../../hardware';
import { DBVariantAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type {
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<any> {
    const path = await this.getAccountPath();
    return OneKeyHardware.solanaSignTransaction(path, unsignedTx);
  }

  signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    console.log(params);
    throw new NotImplemented();
  }
}
