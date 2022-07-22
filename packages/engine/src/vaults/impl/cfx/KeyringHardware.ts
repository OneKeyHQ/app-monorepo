/* eslint-disable @typescript-eslint/no-unused-vars */
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

  signMessage(_messages: any[], _options: ISignCredentialOptions): any {
    throw new NotImplemented();
  }

  override prepareAccounts(
    _params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    throw new NotImplemented();
  }

  override getAddress(): Promise<string> {
    throw new NotImplemented();
  }
}
