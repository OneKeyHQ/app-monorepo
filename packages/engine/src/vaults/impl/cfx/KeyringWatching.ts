import { COINTYPE_CFX as COIN_TYPE } from '../../../constants';
import { InvalidAddress } from '../../../errors';
import { AccountType, DBVariantAccount } from '../../../types/account';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';
import { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, target } = params;
    const { normalizedAddress, isValid } =
      await this.engine.providerManager.verifyAddress(this.networkId, target);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }

    // TODO: remove addressToBase from proxy.ts
    const address = await this.engine.providerManager.addressToBase(
      this.networkId,
      normalizedAddress,
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
        addresses: { [this.networkId]: normalizedAddress },
      },
    ];
  }
}
