import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    // TODO: Add stakingAddress

    // const client = await (this.vault as AdaVault).getClient();
    // let addressInfo;
    // try {
    //   addressInfo = await client.getAddress(normalizedAddress);
    // } catch {
    //   throw new InvalidAccount();
    // }
    // const firstAddressRelPath = '0/0';
    // const stakingAddressPath = '2/0';
    // const addresses = {
    //   [firstAddressRelPath]: normalizedAddress,
    //   [stakingAddressPath]: addressInfo.stake_address,
    // };

    return super.basePrepareUtxoWatchingAccounts(params);
  }
}
