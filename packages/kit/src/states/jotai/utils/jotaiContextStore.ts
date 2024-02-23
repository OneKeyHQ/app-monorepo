import { createStore } from 'jotai';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IJotaiContextStore } from './createJotaiContext';

export function buildJotaiContextStoreId(data: IJotaiContextStoreData) {
  const { storeName, accountSelectorInfo } = data;
  let storeId = `${storeName}`;
  if (accountSelectorInfo) {
    const sceneId =
      accountUtils.buildAccountSelectorSceneId(accountSelectorInfo);
    storeId = `${storeId}@${sceneId}`;
  }
  return storeId;
}

// AccountSelectorStore
class JotaiContextStore {
  storeCache = new Map<string, IJotaiContextStore>();

  createStore(data: IJotaiContextStoreData): IJotaiContextStore {
    const id = buildJotaiContextStoreId(data);
    const store = createStore();
    this.storeCache.set(id, store);
    return store;
  }

  getStore(data: IJotaiContextStoreData): IJotaiContextStore | undefined {
    const id = buildJotaiContextStoreId(data);
    return this.storeCache.get(id);
  }

  removeStore(data: IJotaiContextStoreData) {
    const id = buildJotaiContextStoreId(data);
    this.storeCache.delete(id);
    console.log('JotaiContextStore removeStore', id);
  }

  getOrCreateStore(data: IJotaiContextStoreData): IJotaiContextStore {
    let store = this.getStore(data);
    if (!store) {
      store = this.createStore(data);
    }
    return store;
  }
}

const jotaiContextStore = new JotaiContextStore();
if (process.env.NODE_ENV !== 'production') {
  global.$$jotaiContextStore = jotaiContextStore;
  global.$$jotaiContextStorePrint = () => {
    console.log(global.$$jotaiContextStore);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    global.$$allAtoms.jotaiContextStoreMapAtom.get().then(console.log);
  };
}
export { jotaiContextStore };
