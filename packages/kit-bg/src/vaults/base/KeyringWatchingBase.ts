/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import {
  InvalidAddress,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';

import { EDBAccountType, WALLET_TYPE_WATCHING } from '../../dbs/local/consts';
import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBSimpleAccount } from '../../dbs/local/types';

export abstract class KeyringWatchingBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.watching;

  async signTransaction(): Promise<ISignedTxPro> {
    throw new OneKeyInternalError(
      'signTransaction is not supported for watching accounts',
    );
  }

  async signMessage(): Promise<string[]> {
    throw new OneKeyInternalError(
      'signMessage is not supported for watching accounts',
    );
  }

  async basePrepareSimpleWatchingAccounts({
    coinType,
    impl,
    address,
    name,
  }: {
    coinType: string;
    impl: string;
    address: string;
    name: string;
  }) {
    if (!address) {
      throw new InvalidAddress();
    }
    const account: IDBSimpleAccount = {
      id: `${WALLET_TYPE_WATCHING}--${coinType}--${address}`,
      name: name || '',
      type: EDBAccountType.SIMPLE,
      coinType,
      impl,
      address,
      pub: '',
      path: '',
    };
    return Promise.resolve([account]);
  }
}
