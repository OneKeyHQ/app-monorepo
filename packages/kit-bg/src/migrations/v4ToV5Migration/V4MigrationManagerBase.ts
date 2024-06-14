import type { CoreChainScopeBase } from '@onekeyhq/core/src/base/CoreChainScopeBase';
import { getCoreChainApiScopeByImpl } from '@onekeyhq/core/src/instance/coreChainApi';
import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import v4dbHubs from './v4dbHubs';
import { EV4LocalDBStoreNames } from './v4local/v4localDBStoreNames';

import type { V4DbHubs } from './v4dbHubs';
import type { IV4DBAccount, IV4DBWallet } from './v4local/v4localDBTypes';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export class V4MigrationManagerBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
    ensureRunOnBackground();
  }

  backgroundApi: IBackgroundApi;

  v4dbHubs: V4DbHubs = v4dbHubs;

  getMigrationPassword() {
    return this.backgroundApi.serviceV4Migration.getMigrationPassword();
  }

  getCoreApi({ networkId }: { networkId: string }): CoreChainScopeBase {
    const impl = networkUtils.getNetworkImpl({ networkId });
    const coreApi = getCoreChainApiScopeByImpl({ impl });
    if (!coreApi) {
      throw new Error(`No coreApi found for networkId ${networkId}`);
    }
    return coreApi;
  }

  async getV4AccountsOfWallet({ v4wallet }: { v4wallet: IV4DBWallet }) {
    const r = await v4dbHubs.v4localDb.getAllRecords({
      name: EV4LocalDBStoreNames.Account,
      ids: v4wallet.accounts,
    });
    const v4accounts: IV4DBAccount[] = r?.records || [];
    return v4accounts.filter(Boolean);
  }
}
