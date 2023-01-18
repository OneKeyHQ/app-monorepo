import type { Provider } from '@onekeyhq/blockchain-libs/src/provider/chains/btc/provider';
import { COINTYPE_BTC as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { InvalidAddress } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

import type { DBUTXOAccount } from '../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { target, name, accountIdPrefix } = params;
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;
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
