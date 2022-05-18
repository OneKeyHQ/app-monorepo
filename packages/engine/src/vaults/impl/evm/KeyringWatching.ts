import { COINTYPE_ETH as COIN_TYPE } from '../../../constants';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { IPrepareWatchingAccountsParams } from '../../../types/vault';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

export class KeyringWatching extends KeyringWatchingBase {
  override prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, target } = params;
    return Promise.resolve([
      {
        id: `watching--${COIN_TYPE}--${target}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address: target,
      },
    ]);
  }
}
