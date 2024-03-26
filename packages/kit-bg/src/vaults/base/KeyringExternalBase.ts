/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { Linking } from 'react-native';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBAccount, IDBExternalAccount } from '../../dbs/local/types';
import type {
  IPrepareAccountsParams,
  IPrepareExternalAccountsParams,
} from '../types';

export abstract class KeyringExternalBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.external;

  async signMessage(): Promise<string[]> {
    throw new OneKeyInternalError(
      'signMessage is not supported for external accounts',
    );
  }

  override prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<IDBAccount[]> {
    throw new OneKeyInternalError(
      'prepareAccounts is not supported for external accounts, use serviceAccount directly',
    );
  }

  // TODO use serviceAccount directly
  async basePrepareExternalAccounts(
    params: IPrepareExternalAccountsParams,
  ): Promise<IDBExternalAccount[]> {
    return [];
    // const { name, networks, wcTopic, wcPeerMeta } = params;

    // if (!wcTopic || !wcPeerMeta) {
    //   throw new Error('ExternalAccounts only support walletconnect yet');
    // }

    // const account: IDBExternalAccount = {
    //   id: `${WALLET_TYPE_EXTERNAL}--wc--${wcPeerMeta?.name}`,
    //   type: EDBAccountType.VARIANT,
    //   name,
    //   networks,
    //   wcTopic,
    //   wcPeerMeta, // TODO remove
    //   address: '',
    //   path: '',
    //   coinType: '',
    //   impl: '',
    //   pub: '',
    //   addresses: {},
    // };
    // return Promise.resolve([account]);
    // const { address, name, networks, createAtNetwork } = params;
    // if (!address) {
    //   throw new InvalidAddress();
    // }
    // if (!createAtNetwork) {
    //   throw new Error(
    //     'basePrepareSimpleWatchingAccounts ERROR: createAtNetwork is not defined',
    //   );
    // }
    // const { onlyAvailableOnCertainNetworks = false } = options;
    // const settings = await this.getVaultSettings();
    // const coinType = options.coinType || settings.coinTypeDefault;
    // const impl = options.impl || settings.impl;
    // const account: IDBSimpleAccount = {
    //   id: `${WALLET_TYPE_WATCHING}--${coinType}--${address}`,
    //   name: name || '',
    //   type: EDBAccountType.SIMPLE,
    //   coinType,
    //   impl,
    //   networks: onlyAvailableOnCertainNetworks ? networks : undefined,
    //   createAtNetwork,
    //   address,
    //   pub: '',
    //   path: '',
    // };
    // return Promise.resolve([account]);
  }
}
