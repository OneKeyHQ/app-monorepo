import { createStore } from 'jotai';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';

import type { IJotaiContextStore } from './createJotaiContext';

export function buildJotaiContextStoreId(data: IJotaiContextStoreData) {
  const { storeName, accountSelectorInfo } = data;
  let storeId: string = storeName;
  if (accountSelectorInfo) {
    const sceneId =
      accountSelectorUtils.buildAccountSelectorSceneId(accountSelectorInfo);
    storeId = `${storeId}@${sceneId}`;
  }
  return storeId;
}

function setStoreColdStartScopeKey({
  store,
  storeId,
}: {
  store: IJotaiContextStore;
  storeId: string;
}) {
  (
    store as IJotaiContextStore & {
      __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string;
    }
  ).__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__ = `store:${storeId}`;
}

// AccountSelectorStore
class JotaiContextStore {
  storeCache = new Map<string, IJotaiContextStore>();

  storeResetRequests = new Map<string, IJotaiContextStore>();

  createStore(data: IJotaiContextStoreData): IJotaiContextStore {
    const id = buildJotaiContextStoreId(data);
    const store = createStore();
    setStoreColdStartScopeKey({ store, storeId: id });
    this.storeCache.set(id, store);
    return store;
  }

  getStore(data: IJotaiContextStoreData): IJotaiContextStore | undefined {
    const id = buildJotaiContextStoreId(data);
    return this.storeCache.get(id);
  }

  removeStore(data: IJotaiContextStoreData) {
    const id = buildJotaiContextStoreId(data);
    this.removeStoreById(id);
  }

  removeStoreById(id: string) {
    this.storeResetRequests.delete(id);
    this.storeCache.delete(id);
    console.log('JotaiContextStore removeStore', id);
  }

  cancelStoreResetById(id: string, store: IJotaiContextStore) {
    if (this.storeCache.get(id) === store) {
      this.storeResetRequests.delete(id);
    }
  }

  cancelStoreReset(data: IJotaiContextStoreData, store: IJotaiContextStore) {
    const id = buildJotaiContextStoreId(data);
    this.cancelStoreResetById(id, store);
  }

  requestStoreResetById(id: string, store: IJotaiContextStore) {
    if (this.storeCache.get(id) !== store) {
      return;
    }
    this.storeResetRequests.set(id, store);
  }

  requestStoreReset(data: IJotaiContextStoreData, store: IJotaiContextStore) {
    const id = buildJotaiContextStoreId(data);
    this.requestStoreResetById(id, store);
  }

  completeStoreResetIfRequestedById(id: string) {
    const resetStore = this.storeResetRequests.get(id);
    if (!resetStore) {
      return;
    }
    this.storeResetRequests.delete(id);
    if (this.storeCache.get(id) === resetStore) {
      this.storeCache.delete(id);
      console.log('JotaiContextStore removeStore', id);
    }
  }

  getOrCreateStore(data: IJotaiContextStoreData): IJotaiContextStore {
    const id = buildJotaiContextStoreId(data);
    let store = this.storeCache.get(id);
    if (!store) {
      store = this.createStore(data);
    }
    return store;
  }
}

const jotaiContextStore = new JotaiContextStore();
if (process.env.NODE_ENV !== 'production') {
  appGlobals.$$jotaiContextStore = jotaiContextStore;
  appGlobals.$$jotaiContextStorePrint = () => {
    console.log(appGlobals.$$jotaiContextStore);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    appGlobals.$$allAtoms.jotaiContextStoreMapAtom.get().then(console.log);
  };
}
export { jotaiContextStore };
