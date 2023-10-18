import { COINTYPE_CFX as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { AccountType } from '../../../../types/account';
import { KeyringWatchingBase } from '../../../keyring/KeyringWatchingBase';

import type { DBVariantAccount } from '../../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, target, accountIdPrefix } = params;
    const normalizedAddress = await this.vault.validateAddress(target);
    // TODO: remove addressToBase from proxy.ts
    const address = await this.vault.addressToBase(normalizedAddress);
    return [
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${address}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address,
        addresses: { [this.networkId]: normalizedAddress },
      },
    ];
  }
}
