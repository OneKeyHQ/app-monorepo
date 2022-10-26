import { InvalidAddress } from '../../../errors';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';
import { IPrepareWatchingAccountsParams } from '../../types';

import type BTCForkVault from './VaultBtcFork';

export class KeyringWatching extends KeyringWatchingBase {
  async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    console.log('doge watching prepareAccount');
    const { target, name, accountIdPrefix } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    if (!provider.isValidXpub(target)) {
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
