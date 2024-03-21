import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    return super.basePrepareUtxoWatchingAccounts(params);
    //   const { name, target, accountIdPrefix } = params;
    //   const { normalizedAddress, isValid } = mockVerifyAddress({
    //     address: target,
    //   });
    //   if (!isValid || typeof normalizedAddress === 'undefined') {
    //     throw new InvalidAddress();
    //   }

    //   return Promise.resolve([
    //     {
    //       id: `${accountIdPrefix}--${COIN_TYPE}--${normalizedAddress}`,
    //       name: name || '',
    //       type: ,
    //       path: '',
    //       coinType: COIN_TYPE,
    //       pub: '', // TODO: only address is supported for now.
    //       address: normalizedAddress,
    //     },
    //   ]);
  }
}
