/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import { OneKeyInternalError } from '../../errors';

import { KeyringBase } from './KeyringBase';

import type { ISignCredentialOptions } from '../../types/vault';

export abstract class KeyringWatchingBase extends KeyringBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    throw new OneKeyInternalError(
      'Signing is not supported for watching accounts',
    );
  }

  async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new OneKeyInternalError(
      'Signing is not supported for watching accounts',
    );
  }
}
