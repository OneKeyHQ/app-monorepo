import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import localDb from '../dbs/local/localDbInstance';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceOnboarding extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

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

    return {
      accountsCount,
      indexedAccountsCount,
      walletsCount,
      isOnboardingDone:
        accountsCount > 0 || indexedAccountsCount > 0 || walletsCount > 3,
    };
  }
}

export default ServiceOnboarding;
