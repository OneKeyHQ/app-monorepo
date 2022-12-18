import { COINTYPE_ADA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { InvalidAccount, InvalidAddress } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

import type { DBUTXOAccount } from '../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../types';
import type AdaVault from './Vault';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { target, name, accountIdPrefix } = params;
    const normalizedAddress = await this.vault.validateAddress(target);
    if (typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }

    const client = await (this.vault as AdaVault).getClient();
    let addressInfo;
    try {
      addressInfo = await client.getAddress(normalizedAddress);
    } catch {
      throw new InvalidAccount();
    }
    const firstAddressRelPath = '0/0';
    const stakingAddressPath = '2/0';
    const addresses = {
      [firstAddressRelPath]: normalizedAddress,
      [stakingAddressPath]: addressInfo.stake_address,
    };

    return Promise.resolve([
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${target}`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub: '',
        address: normalizedAddress,
        addresses,
      },
    ]);
  }
}
