import { createStore } from 'jotai';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';

class AccountSelectorStore {
  storeCache = new Map<string, IJotaiContextStore>();

  createStore({
    config,
  }: {
    config: IAccountSelectorContextData;
  }): IJotaiContextStore {
    const sceneId = accountUtils.buildAccountSelectorSceneId(config);
    const store = createStore();
    this.storeCache.set(sceneId, store);
    return store;
  }

  getStore({
    config,
  }: {
    config: IAccountSelectorContextData;
  }): IJotaiContextStore | undefined {
    const sceneId = accountUtils.buildAccountSelectorSceneId(config);
    return this.storeCache.get(sceneId);
  }

  removeStore({ config }: { config: IAccountSelectorContextData }) {
    const sceneId = accountUtils.buildAccountSelectorSceneId(config);
    this.storeCache.delete(sceneId);
    console.log('AccountSelectorStore removeStore', sceneId);
  }

  getOrCreateStore({
    config,
  }: {
    config: IAccountSelectorContextData;
  }): IJotaiContextStore {
    let store = this.getStore({ config });
    if (!store) {
      store = this.createStore({ config });
    }
    return store;
  }
}

const accountSelectorStore = new AccountSelectorStore();
if (process.env.NODE_ENV !== 'production') {
  global.$$accountSelectorStore = accountSelectorStore;
}
export { accountSelectorStore };
