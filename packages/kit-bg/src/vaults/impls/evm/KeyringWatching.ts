import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import {
  COINTYPE_ETH,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBSimpleAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBSimpleAccount[]> {
    const { name, address } = params;

    return super.basePrepareSimpleWatchingAccounts({
      coinType: COINTYPE_ETH,
      impl: IMPL_EVM,
      address,
      name,
    });
  }
}
