import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceOnboarding extends ServiceBase {
  @backgroundMethod()
  public async isOnboardingDone() {
    const { count: accountsCount } = await localDb.getRecordsCount({
      name: ELocalDBStoreNames.Account,
    });
    const { count: indexedAccountsCount } = await localDb.getRecordsCount({
      name: ELocalDBStoreNames.IndexedAccount,
    });
    const { count: walletsCount } = await localDb.getRecordsCount({
      name: ELocalDBStoreNames.Wallet,
    });

    const isOnboardingDone =
      accountsCount > 0 ||
      indexedAccountsCount > 0 ||
      // watching\imported\external 3 wallets created in default
      // TODO lazy _addSingletonWalletRecord
      walletsCount > 3;

    return {
      accountsCount,
      indexedAccountsCount,
      walletsCount,
      isOnboardingDone,
    };
  }
}

export default ServiceOnboarding;
