import { createStore } from 'jotai';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

let jotaiContextStoreDebugIndex = 0;
const jotaiContextStoreDebugIds = new WeakMap<object, string>();

export function getJotaiContextStoreDebugId(store: object) {
  let debugId = jotaiContextStoreDebugIds.get(store);
  if (!debugId) {
    jotaiContextStoreDebugIndex += 1;
    debugId = `jotai-store-${jotaiContextStoreDebugIndex}`;
    jotaiContextStoreDebugIds.set(store, debugId);
  }
  return debugId;
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

  logDiscoveryBrowserStore(params: {
    step:
      | 'jotaiContextStoreCreate'
      | 'jotaiContextStoreGet'
      | 'jotaiContextStoreGetOrCreate'
      | 'jotaiContextStoreRemove';
    data: IJotaiContextStoreData;
    logicalStoreId: string;
    store?: IJotaiContextStore;
    hadCachedStore?: boolean;
    result?: 'success' | 'skipped';
  }) {
    const { data, hadCachedStore, logicalStoreId, result, step, store } =
      params;
    if (data.storeName !== EJotaiContextStoreNames.discoveryBrowser) {
      return;
    }
    defaultLogger.discovery.browser.browserTabsLifecycle({
      step,
      source: 'jotaiContextStore',
      storeName: data.storeName,
      logicalStoreId,
      storeIdentity: store ? getJotaiContextStoreDebugId(store) : undefined,
      hadCachedStore,
      result,
    });
  }

  createStore(data: IJotaiContextStoreData): IJotaiContextStore {
    const id = buildJotaiContextStoreId(data);
    const store = createStore();
    setStoreColdStartScopeKey({ store, storeId: id });
    this.storeCache.set(id, store);
    this.logDiscoveryBrowserStore({
      step: 'jotaiContextStoreCreate',
      data,
      logicalStoreId: id,
      store,
      hadCachedStore: false,
      result: 'success',
    });
    return store;
  }

  getStore(data: IJotaiContextStoreData): IJotaiContextStore | undefined {
    const id = buildJotaiContextStoreId(data);
    const store = this.storeCache.get(id);
    this.logDiscoveryBrowserStore({
      step: 'jotaiContextStoreGet',
      data,
      logicalStoreId: id,
      store,
      hadCachedStore: Boolean(store),
      result: store ? 'success' : 'skipped',
    });
    return store;
  }

  removeStore(data: IJotaiContextStoreData) {
    const id = buildJotaiContextStoreId(data);
    const store = this.storeCache.get(id);
    this.storeCache.delete(id);
    this.logDiscoveryBrowserStore({
      step: 'jotaiContextStoreRemove',
      data,
      logicalStoreId: id,
      store,
      hadCachedStore: Boolean(store),
      result: store ? 'success' : 'skipped',
    });
    console.log('JotaiContextStore removeStore', id);
  }

  getOrCreateStore(data: IJotaiContextStoreData): IJotaiContextStore {
    let store = this.getStore(data);
    const hadCachedStore = Boolean(store);
    const id = buildJotaiContextStoreId(data);
    if (!store) {
      store = this.createStore(data);
    }
    this.logDiscoveryBrowserStore({
      step: 'jotaiContextStoreGetOrCreate',
      data,
      logicalStoreId: id,
      store,
      hadCachedStore,
      result: 'success',
    });
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
