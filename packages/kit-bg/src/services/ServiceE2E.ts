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

import type { IDBBaseObject } from '../dbs/local/types';

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
  async exportAllAccountsData(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    const { serviceAccount } = this.backgroundApi;
    const { accounts } = await serviceAccount.getAllAccounts();
    const { wallets } = await serviceAccount.getAllWallets();
    const { devices } = await serviceAccount.getAllDevices();
    const sortFn = (a: IDBBaseObject, b: IDBBaseObject) =>
      natsort({ insensitive: true })(a.id, b.id);
    return {
      accounts: accounts.sort(sortFn),
      wallets: wallets.sort(sortFn),
      devices: devices.sort(sortFn),
    };
  }
}

export default ServiceE2E;
