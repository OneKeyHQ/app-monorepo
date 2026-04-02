import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    throw new NotImplemented();
  }
}
