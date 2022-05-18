import { COINTYPE_CFX as COIN_TYPE } from '../../../constants';
import { AccountType, DBVariantAccount } from '../../../types/account';
import { IPrepareWatchingAccountsParams } from '../../../types/vault';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, target } = params;
    // TODO: remove addressToBase from proxy.ts
    const address = await this.engine.providerManager.addressToBase(
      this.networkId,
      target,
    );
    return [
      {
        id: `watching--${COIN_TYPE}--${address}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address,
        addresses: { [this.networkId]: target },
      },
    ];
  }
}
