/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    _: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    throw new NotImplemented();
  }
}
