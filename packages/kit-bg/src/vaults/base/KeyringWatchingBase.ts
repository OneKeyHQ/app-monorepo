/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';

import { EDBAccountType } from '../../dbs/local/consts';
import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBAccount, IDBSimpleAccount } from '../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../types';

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

  async basePrepareUtxoWatchingAccounts(): Promise<IDBAccount[]> {
    throw new NotImplemented();
  }

  async basePrepareSimpleWatchingAccounts(
    params: IPrepareWatchingAccountsParams,
    options: {
      onlyAvailableOnCertainNetworks?: boolean;
      impl?: string;
      coinType?: string;
      // accountType?: EDBAccountType;
    } = {},
  ): Promise<IDBAccount[]> {
    const { address, name, networks, createAtNetwork } = params;
    if (!address) {
      throw new InvalidAddress();
    }
    if (!createAtNetwork) {
      throw new Error(
        'basePrepareSimpleWatchingAccounts ERROR: createAtNetwork is not defined',
      );
    }
    const { onlyAvailableOnCertainNetworks = false } = options;
    const settings = await this.getVaultSettings();
    const coinType = options.coinType || settings.coinTypeDefault;
    const impl = options.impl || settings.impl;

    const account: IDBSimpleAccount = {
      id: `${WALLET_TYPE_WATCHING}--${coinType}--${address}`,
      name: name || '',
      type: EDBAccountType.SIMPLE,
      coinType,
      impl,
      networks: onlyAvailableOnCertainNetworks ? networks : undefined,
      createAtNetwork,
      address,
      pub: '',
      path: '',
    };
    return Promise.resolve([account]);
  }
}
