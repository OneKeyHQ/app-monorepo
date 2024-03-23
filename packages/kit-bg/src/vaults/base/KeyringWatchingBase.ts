/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import type { EAddressEncodings, ISignedTxPro } from '@onekeyhq/core/src/types';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  InvalidAddress,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { EDBAccountType } from '../../dbs/local/consts';
import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type {
  IDBAccount,
  IDBSimpleAccount,
  IDBUtxoAccount,
} from '../../dbs/local/types';
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

  async basePrepareUtxoWatchingAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBUtxoAccount[]> {
    const { address, xpub, networks, createAtNetwork, name, deriveInfo } =
      params;
    if (!address && !xpub) {
      throw new Error(
        'basePrepareUtxoWatchingAccounts ERROR: address and xpub are not defined',
      );
    }
    const networkInfo = await this.getCoreApiNetworkInfo();

    const settings = await this.getVaultSettings();
    const coinType = settings.coinTypeDefault;

    // xpub build
    const addressEncoding: EAddressEncodings | undefined =
      deriveInfo?.addressEncoding;

    const id = accountUtils.buildWatchingAccountId({
      coinType,
      address,
      xpub,
      addressEncoding,
    });
    let addressFromXpub = '';
    if (!address && xpub) {
      checkIsDefined(this.coreApi);
      const result = await this.coreApi?.getAddressFromPublic({
        publicKey: xpub,
        addressEncoding,
        networkInfo,
      });
      addressFromXpub = result?.address || '';
    }

    const account: IDBUtxoAccount = {
      id,
      name,
      type: EDBAccountType.UTXO,
      relPath: '0/0',
      coinType,
      impl: settings.impl,
      networks,
      createAtNetwork,
      address: addressFromXpub || address || '',
      xpub: xpub || '',
      path: '',
      addresses: {},
    };
    return [account];
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
