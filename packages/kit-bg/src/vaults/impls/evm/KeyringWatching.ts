import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import { COINTYPE_ETH as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { InvalidAddress } from '@onekeyhq/shared/src/errors';

import { EDBAccountType } from '../../../dbs/local/consts';
import { mockVerifyAddress } from '../../../mock';
import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBSimpleAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<IDBSimpleAccount>> {
    const { name, target, accountIdPrefix } = params;
    // const { normalizedAddress, isValid } = await (
    //   this.vault as VaultEvm
    // ).verifyAddress(target);
    const { normalizedAddress, isValid } = mockVerifyAddress({
      address: target,
    });
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }

    return Promise.resolve([
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${normalizedAddress}`,
        name: name || '',
        type: EDBAccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address: normalizedAddress,
      },
    ]);
  }
}
