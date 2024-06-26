import {
  getBtcForkNetwork,
  getPublicKeyFromXpub,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi = coreChainApi.btc.hd;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    const accounts = await super.basePrepareUtxoWatchingAccounts(params);
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    for (const account of accounts) {
      if (!account.pub && account.xpub) {
        const pub = getPublicKeyFromXpub({
          xpub: account.xpub,
          network,
          relPath: '0/0',
        });
        account.pub = pub;
      }
    }
    return accounts;
  }
}
