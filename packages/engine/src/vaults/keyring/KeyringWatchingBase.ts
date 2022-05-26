/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import { OneKeyInternalError } from '../../errors';

import { KeyringBase } from './KeyringBase';

import type { ISignCredentialOptions } from '../types';

export abstract class KeyringWatchingBase extends KeyringBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    throw new OneKeyInternalError(
      'signTransaction is not supported for watching accounts',
    );
  }

  async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new OneKeyInternalError(
      'signMessage is not supported for watching accounts',
    );
  }

  // prepareAccounts(params: any): Promise<Array<any>> {
  //   throw new OneKeyInternalError(
  //     'prepareAccounts is not supported for watching accounts',
  //   );
  // }
}
