/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import type { ICoreUnsignedMessage } from '@onekeyhq/core/src/types';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { EVaultKeyringTypes, type ISignCredentialOptions } from '../types';

import { KeyringBase } from './KeyringBase';

export abstract class KeyringWatchingBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.watching;

  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    throw new OneKeyInternalError(
      'signTransaction is not supported for watching accounts',
    );
  }

  async signMessage(
    messages: ICoreUnsignedMessage[],
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

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }

  override prepareAccountByAddressIndex(): Promise<[]> {
    throw new Error('Method not implemented.');
  }
}
