import { memo, useEffect, useMemo } from 'react';

import { uniq } from 'lodash';

import type {
  IJotaiContextStoreData,
  IJotaiContextStoreMap,
  IJotaiContextStoreMapValue,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  getJotaiContextTrackerMap,
  useJotaiContextStoreMapAtom,
  useJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { isSwapColdStartAllNetworkContextNetworkId } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';

import { JotaiContextRootProviderRenderer } from './JotaiContextRootProviderRenderer';
import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from './jotaiContextStore';

type IGlobalColdStartSnapshot = typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};

type ISelectedAccountSnapshot = {
  networkId?: string;
};

type ISelectedAccountsSnapshot = Record<
  string | number,
  ISelectedAccountSnapshot | undefined
>;

const COLD_START_SCOPED_KEY_SEPARATOR = '::';
const ACCOUNT_SELECTOR_HOME_SCOPE_KEY = 'store:accountSelector@home';

function getColdStartSnapshot() {
  return (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__;
}

function buildContextAtomSnapshotKey({
  coldStartScopeKey,
  coldStartCacheKey,
}: {
  coldStartScopeKey: string;
  coldStartCacheKey: string;
}) {
  return `${coldStartScopeKey}${COLD_START_SCOPED_KEY_SEPARATOR}${coldStartCacheKey}`;
}

function hasAllNetworkHomeSelectedAccountSnapshot() {
  const snapshot = getColdStartSnapshot();
  if (!snapshot) {
    return false;
  }

  const selectedAccounts = snapshot[
    buildContextAtomSnapshotKey({
      coldStartScopeKey: ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
      coldStartCacheKey:
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
    })
  ] as ISelectedAccountsSnapshot | null | undefined;
  const selectedAccount = selectedAccounts?.[0] ?? selectedAccounts?.['0'];
  return isSwapColdStartAllNetworkContextNetworkId(selectedAccount?.networkId);
}

function hasPerpsColdStartSnapshot() {
  if (!platformEnv.isNative && !platformEnv.isDesktop) {
    return false;
  }

  const snapshot = getColdStartSnapshot();
  if (!snapshot) {
    return false;
  }

  const perpsColdStartCacheKeys = [
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsL2BookColdCacheAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom,
  ];
  return Object.keys(snapshot).some((key) =>
    perpsColdStartCacheKeys.some((cacheKey) => key.endsWith(`::${cacheKey}`)),
  );
}

function hasSwapColdStartSnapshot() {
  if (!platformEnv.isNative && !platformEnv.isDesktop) {
    return false;
  }

  const snapshot = getColdStartSnapshot();
  if (!snapshot) {
    return false;
  }

  const swapColdStartCacheKeys = [
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTipsStateAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom,
  ];
  return (
    Object.keys(snapshot).some((key) =>
      swapColdStartCacheKeys.some((cacheKey) => key.endsWith(`::${cacheKey}`)),
    ) || hasAllNetworkHomeSelectedAccountSnapshot()
  );
}

// AccountSelectorMapTracker
export function JotaiContextStoreMirrorTracker(data: IJotaiContextStoreData) {
  const { storeName, accountSelectorInfo } = data;
  useDebugComponentRemountLog({
    name: `JotaiContextStoreMirrorTracker`,
    payload: data,
  });
  const { setMap } = useJotaiContextTrackerMap();
  const storeId = buildJotaiContextStoreId(data);
  useEffect(() => {
    const processMapCount = (action: 'add' | 'remove') => {
      const toMergeMap: IJotaiContextStoreMap = {};

      const mapCache = getJotaiContextTrackerMap();

      const key = storeId;
      let value: IJotaiContextStoreMapValue | undefined = mapCache[key];
      if (!value) {
        value = {
          storeName,
          accountSelectorInfo,
          count: 0,
        };
      }
      if (action === 'add') {
        value.count += 1;
        if (accountSelectorInfo && value.accountSelectorInfo) {
          value.accountSelectorInfo.enabledNum = uniq([
            ...value.accountSelectorInfo.enabledNum,
            ...accountSelectorInfo.enabledNum,
          ]).toSorted();
        }
      }
      if (action === 'remove') {
        value.count -= 1;
      }
      if (value.count <= 0) {
        delete mapCache[key];
      } else {
        toMergeMap[key] = value;
      }

      setMap({
        ...mapCache,
        ...toMergeMap,
      });

      if (action === 'remove' && value.count <= 0) {
        jotaiContextStore.completeStoreResetIfRequestedById(storeId);
      }
    };

    processMapCount('add');

    return () => {
      processMapCount('remove');
    };
  }, [accountSelectorInfo, setMap, storeId, storeName]);

  return null;
}

function JotaiContextRootProvidersAutoMountCmp() {
  const [map] = useJotaiContextStoreMapAtom();
  const mapEntries = useMemo(() => Object.entries(map), [map]);
  const shouldMountSwapColdStartRootProvider = useMemo(
    () => hasSwapColdStartSnapshot(),
    [],
  );
  const shouldMountPerpsColdStartRootProvider = useMemo(
    () => hasPerpsColdStartSnapshot(),
    [],
  );
  // const mapEntries = [];
  if (process.env.NODE_ENV !== 'production') {
    // console.log(
    //   'JotaiContextRootProvidersAutoMount mapEntries:',
    //   mapEntries,
    //   getJotaiContextTrackerMap(),
    //   appGlobals.$$jotaiContextStore,
    // );
  }
  return (
    <JotaiContextRootProviderRenderer
      mapEntries={mapEntries}
      shouldMountPerpsColdStartRootProvider={
        shouldMountPerpsColdStartRootProvider
      }
      shouldMountSwapColdStartRootProvider={
        shouldMountSwapColdStartRootProvider
      }
    />
  );
}

export const JotaiContextRootProvidersAutoMount = memo(
  JotaiContextRootProvidersAutoMountCmp,
);
