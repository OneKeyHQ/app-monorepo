import { COINTYPE_NEAR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { InvalidAddress } from '../../../../errors';
import { AccountType } from '../../../../types/account';
import { KeyringWatchingBase } from '../../../keyring/KeyringWatchingBase';
import { verifyNearAddress } from '../utils';

import type { DBSimpleAccount } from '../../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, target: address, accountIdPrefix } = params;
    const { normalizedAddress, isValid } = verifyNearAddress(address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }

    return Promise.resolve([
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${address}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address: normalizedAddress,
      },
    ]);
  }
}
