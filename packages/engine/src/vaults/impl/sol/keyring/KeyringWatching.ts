import { COINTYPE_SOL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { InvalidAddress } from '@onekeyhq/shared/src/errors';

import { AccountType } from '../../../../types/account';
import { KeyringWatchingBase } from '../../../keyring/KeyringWatchingBase';

import type { DBSimpleAccount } from '../../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, target } = params;
    const isValid = await this.vault.validateWatchingCredential(target);
    if (!isValid) {
      throw new InvalidAddress();
    }

    return Promise.resolve([
      {
        id: `watching--${COIN_TYPE}--${target}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: target, // bs58 encoded
        address: target,
      },
    ]);
  }
}
