import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { IAdaAddressInfo } from '@onekeyhq/core/src/chains/ada/types';
import { InvalidAccount } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { KeyringWatchingBase } from '../../base/KeyringWatchingBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override coreApi: CoreChainApiBase | undefined;

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<IDBAccount[]> {
    const { address } = params;
    let addressInfo: IAdaAddressInfo;
    try {
      [addressInfo] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<IAdaAddressInfo>(
          {
            networkId: this.networkId,
            body: [
              {
                route: 'rpc',
                params: {
                  method: 'GET',
                  params: [],
                  url: `/addresses/${address}`,
                },
              },
            ],
          },
        );
    } catch {
      throw new InvalidAccount({
        key: ETranslations.feedback_address_not_activated_message,
      });
    }
    const firstAddressRelPath = '0/0';
    const stakingAddressPath = '2/0';
    const addresses = {
      [firstAddressRelPath]: address,
      [stakingAddressPath]: addressInfo.stake_address,
    };

    return super.basePrepareUtxoWatchingAccounts({ ...params, addresses });
  }
}
