import { createStore } from 'jotai';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';

class AccountSelectorStore {
  storeCache = new Map<string, IJotaiContextStore>();

  createStore({ config }: { config: IAccountSelectorContextData }) {
    const sceneId = accountUtils.buildAccountSelectorSceneId(config);
    this.storeCache.set(sceneId, createStore());
  }

  getStore({ config }: { config: IAccountSelectorContextData }) {
    const sceneId = accountUtils.buildAccountSelectorSceneId(config);
    return this.storeCache.get(sceneId);
  }

  removeStore({ config }: { config: IAccountSelectorContextData }) {
    const sceneId = accountUtils.buildAccountSelectorSceneId(config);
    this.storeCache.delete(sceneId);
  }

  getOrCreateStore({ config }: { config: IAccountSelectorContextData }) {
    let store = this.getStore({ config });
    if (!store) {
      this.createStore({ config });
    }
    store = this.getStore({ config });
    return store;
  }
}

const accountSelectorStore = new AccountSelectorStore();
export { accountSelectorStore };
