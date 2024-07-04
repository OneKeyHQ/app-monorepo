import natsort from 'natsort';

import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  backgroundClass,
  backgroundMethodForDev,
  checkDevOnlyPassword,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import {
  settingsAtomInitialValue,
  settingsPersistAtom,
} from '../states/jotai/atoms';
import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';
import {
  passwordAtomInitialValue,
  passwordPersistAtom,
} from '../states/jotai/atoms/password';

import ServiceBase from './ServiceBase';

import type { IDBAccount, IDBBaseObject } from '../dbs/local/types';
import { uniq } from 'lodash';

@backgroundClass()
class ServiceE2E extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethodForDev()
  async clearWalletsAndAccounts(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Account,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Wallet,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Credential,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Address,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.IndexedAccount,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Device,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Address,
    });
    await localDb.resetContext();

    await this.backgroundApi.simpleDb.accountSelector.clearRawData();

    appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
  }

  @backgroundMethodForDev()
  async clearAddressBook(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    const { simpleDb } = this.backgroundApi;
    await simpleDb.addressBook.clearRawData();
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      updateTimestamp: undefined,
    }));
  }

  @backgroundMethodForDev()
  async clearPassword(
    params: IBackgroundMethodWithDevOnlyPassword,
  ): Promise<void> {
    checkDevOnlyPassword(params);
    await passwordPersistAtom.set((v) => ({ ...v, isPasswordSet: false }));
    await localDb.resetPasswordSet();
  }

  @backgroundMethodForDev()
  async clearDiscoveryPageData(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    const { serviceDiscovery } = this.backgroundApi;
    await serviceDiscovery.clearDiscoveryPageData();
  }

  @backgroundMethodForDev()
  async clearSettings(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    await settingsPersistAtom.set(settingsAtomInitialValue);
    await passwordPersistAtom.set(passwordAtomInitialValue);
  }

  @backgroundMethodForDev()
  async clearHistoryData(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    await this.backgroundApi.simpleDb.localHistory.clearRawData();
    await localDb.clearRecords({
      name: ELocalDBStoreNames.SignedMessage,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.SignedTransaction,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.ConnectedSite,
    });
  }

  @backgroundMethodForDev()
  async exportAllAccountsData(
    params: IBackgroundMethodWithDevOnlyPassword,
    { normalize }: { normalize?: boolean } = {},
  ) {
    checkDevOnlyPassword(params);
    const { serviceAccount, serviceV4Migration, serviceNetwork } =
      this.backgroundApi;
    let { accounts } = await serviceAccount.getAllAccounts();
    const { wallets } = await serviceAccount.getAllWallets();
    const { devices } = await serviceAccount.getAllDevices();
    const sortFn = (a: IDBBaseObject, b: IDBBaseObject) =>
      natsort({ insensitive: true })(a.id, b.id);
    const v4dbExists = await serviceV4Migration.checkIfV4DbExist();

    if (normalize) {
      accounts = accounts.map((account) => {
        account.name = account.name || 'mockName';
        // account.no
        return account;
      });
    }

    wallets.forEach((wallet) => {
      wallet.accounts = (wallet.accounts || []).sort((a, b) =>
        natsort({ insensitive: true })(a, b),
      );
    });

    const { networks } = await serviceNetwork.getAllNetworks();

    const getMissingImpls = async (accounts0: IDBAccount[]) => {
      const missingImpls: string[] = [];

      for (const network of networks) {
        const impl = network.impl;
        const deriveItems =
          await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork({
            networkId: network.id,
          });
        for (const deriveItem of deriveItems) {
          const matchedAccount = accounts0.find(
            (account) =>
              account.impl === impl &&
              (!account.template ||
                (account.template &&
                  account.template === deriveItem.item.template)),
          );
          if (!matchedAccount) {
            missingImpls.push(`${impl} - ${deriveItem.value}`);
          }
        }
      }

      return uniq(missingImpls);
    };

    const accountsGroupedByWallet: {
      [walletId: string]: IDBAccount[];
    } = {};

    accounts.forEach((account) => {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: account.id,
      });
      if (!accountsGroupedByWallet[walletId]) {
        accountsGroupedByWallet[walletId] = [];
      }
      accountsGroupedByWallet[walletId].push(account);
    });

    const accountMissingImpls: {
      [walletId: string]: string[];
    } = {};

    for (const walletId of Object.keys(accountsGroupedByWallet)) {
      const accounts0: IDBAccount[] = accountsGroupedByWallet[walletId];
      accountMissingImpls[walletId] = await getMissingImpls(accounts0);
    }

    return {
      v4dbExists,
      accountMissingImpls,
      accounts: (accounts || []).sort(sortFn),
      wallets: (wallets || []).sort(sortFn),
      devices: (devices || []).sort(sortFn),
    };
  }
}

export default ServiceE2E;
