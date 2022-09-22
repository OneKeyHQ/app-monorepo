/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import { COINTYPE_APTOS as COIN_TYPE } from '../../../constants';
import { DBSimpleAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

export class KeyringHardware extends KeyringHardwareBase {
  prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
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
