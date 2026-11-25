import { debounce } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { writeWalletPresenceHint } from '@onekeyhq/shared/src/utils/walletPresenceHintUtils';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceOnboarding extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    if (!platformEnv.isNative) {
      return;
    }

    // Keep the cold-start hint in step with wallet changes, so a user who
    // creates their first wallet and kills the app is not sent back to
    // onboarding on the next launch.
    // AccountUpdate fires often; coalesce the DB counts it triggers.
    const refreshHint = debounce(
      () => {
        void this.isOnboardingDone().catch(() => undefined);
      },
      300,
      { maxWait: 1000 },
    );
    const walletChangeEvents = [
      EAppEventBusNames.WalletUpdate,
      EAppEventBusNames.WalletRemove,
      EAppEventBusNames.WalletClear,
      EAppEventBusNames.AccountUpdate,
      EAppEventBusNames.AccountRemove,
      EAppEventBusNames.AddDBAccountsToWallet,
    ] as const;
    walletChangeEvents.forEach((eventName) => {
      appEventBus.on(eventName, refreshHint);
    });
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

    const isOnboardingDone =
      accountsCount > 0 ||
      indexedAccountsCount > 0 ||
      // watching\imported\external 3 wallets created in default
      // TODO lazy _addSingletonWalletRecord
      walletsCount > 3;

    writeWalletPresenceHint({ hasWallet: isOnboardingDone });

    return {
      accountsCount,
      indexedAccountsCount,
      walletsCount,
      isOnboardingDone,
    };
  }
}

export default ServiceOnboarding;
