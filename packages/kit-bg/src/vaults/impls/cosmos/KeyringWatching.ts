import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    return super.basePrepareSimpleWatchingAccounts(params, {
      onlyAvailableOnCertainNetworks: true,
    });
  }
}
