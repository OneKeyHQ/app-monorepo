import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { DB_MAIN_CONTEXT_ID } from '../dbs/local/consts';
import localDb from '../dbs/local/localDbInstance';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import {
  settingsIsLightCNAtom,
  settingsPersistAtom,
  settingsTimeNowAtom,
} from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // ---------------------------------------------- demo

  @backgroundMethod()
  async demoJotaiGetSettings() {
    const now = await settingsTimeNowAtom.get();
    const settings = await settingsPersistAtom.get();

    const isLightCN = await settingsIsLightCNAtom.get();
    return {
      now,
      settings,
      isLightCN,
    };
  }

  @backgroundMethod()
  async demoJotaiUpdateSettings() {
    const now = await settingsTimeNowAtom.set((v) => `${v}: hello world`);
    const settings = await settingsPersistAtom.set((v) => ({
      ...v,
      locale: v.locale !== 'zh-CN' ? 'zh-CN' : 'en-US',
      theme: v.theme !== 'dark' ? 'dark' : 'light',
    }));
    const isLightCN = await settingsIsLightCNAtom.get();
    return {
      now,
      settings,
      isLightCN,
    };
  }

  @backgroundMethod()
  async demoGetAllRecords() {
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.Credential,
    });

    // const ctx = await localDb.getContext();
    return records;
  }

  @backgroundMethod()
  async demoGetDbContextWithoutTx() {
    const ctx = await localDb.getRecordById({
      name: ELocalDBStoreNames.Context,
      id: DB_MAIN_CONTEXT_ID,
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }

  @backgroundMethod()
  async demoGetDbContext() {
    const c = await localDb.demoGetDbContext();
    return c;
  }

  @backgroundMethod()
  async demoDbUpdateUUID() {
    const c = await localDb.demoDbUpdateUUID();
    return c;
  }

  @backgroundMethod()
  async demoDbUpdateUUIDFixed() {
    const ctx = await localDb.demoDbUpdateUUIDFixed();
    return ctx;
  }

  @backgroundMethod()
  async demoAddRecord1() {
    const ctx = await localDb.demoAddRecord1();
    return ctx;
  }

  @backgroundMethod()
  async demoRemoveRecord1() {
    const ctx = await localDb.demoRemoveRecord1();
    return ctx;
  }

  @backgroundMethod()
  async demoUpdateCredentialRecord() {
    const ctx = await localDb.demoUpdateCredentialRecord();
    return ctx;
  }
}

export default ServiceApp;
