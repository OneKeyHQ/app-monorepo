import { InvalidAddress } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

import type { DBUTXOAccount } from '../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../types';
import type BTCForkVault from './VaultBtcFork';

export class KeyringWatching extends KeyringWatchingBase {
  async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    console.log('btcfork watching prepareAccount');
    const { target, name, accountIdPrefix } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    try {
      if (!provider.isValidXpub(target)) {
        throw new InvalidAddress();
      }
    } catch (e) {
      throw new InvalidAddress();
    }

    const firstAddressRelPath = '0/0';
    const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
      target,
      [firstAddressRelPath],
    );
    return [
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${target}`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub: target,
        address,
        addresses: { [firstAddressRelPath]: address },
      },
    ];
  }
}
