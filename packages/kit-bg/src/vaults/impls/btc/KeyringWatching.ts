import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi = coreChainApi.btc.hd;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    return super.basePrepareUtxoWatchingAccounts(params);
  }
}
