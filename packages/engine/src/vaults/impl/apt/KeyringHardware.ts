/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import { DBAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import {
  IHardwareGetAddressParams,
  IPrepareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  prepareAccounts(params: IPrepareAccountsParams): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }

  getAddress(params: IHardwareGetAddressParams): Promise<string> {
    throw new Error('Method not implemented.');
  }

  signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    throw new Error('Method not implemented.');
  }

  signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}
