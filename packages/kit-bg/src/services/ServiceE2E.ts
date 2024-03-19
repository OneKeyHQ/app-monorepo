import {
  backgroundClass,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import localDb from '../dbs/local/localDbInstance';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';
import { passwordPersistAtom } from '../states/jotai/atoms/password';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceE2E extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethodForDev()
  async clearWalletsAndAccounts() {
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
    await localDb.resetContext();

    await this.backgroundApi.simpleDb.accountSelector.clearRawData();

    appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
  }

  @backgroundMethodForDev()
  async dangerClearDataForE2E() {
    const { simpleDb } = this.backgroundApi;
    await simpleDb.addressBook.clearRawData();
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      updateTimestamp: undefined,
    }));
  }

  @backgroundMethodForDev()
  async resetPasswordSetStatus(): Promise<void> {
    await passwordPersistAtom.set((v) => ({ ...v, isPasswordSet: false }));
    await localDb.resetPasswordSet();
  }

  @backgroundMethodForDev()
  async clearDiscoveryPageData() {
    const { simpleDb } = this.backgroundApi;
    await Promise.all([
      simpleDb.browserTabs.clearRawData(),
      simpleDb.browserBookmarks.clearRawData(),
      simpleDb.browserHistory.clearRawData(),
      simpleDb.dappConnection.clearRawData(),
    ]);
  }
}

export default ServiceE2E;
