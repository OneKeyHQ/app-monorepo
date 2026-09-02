import { memo, useEffect, useMemo } from 'react';

import type {
  IJotaiContextStoreData,
  IJotaiContextStoreMap,
  IJotaiContextStoreMapValue,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
  useJotaiContextStoreMapAtom,
  useJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
const SWAP_COLD_START_SCOPE_KEY = `store:${EJotaiContextStoreNames.swap}`;
const accountSelectorEnabledNumCounts = new Map<string, Map<number, number>>();

export type IJotaiContextStoreMirrorRegistrationChange = {
  action: 'add' | 'remove';
  registrationCount: number;
  storeId: string;
};

type IJotaiContextStoreMirrorTrackerProps = IJotaiContextStoreData & {
  onRegistrationChange?: (
    change: IJotaiContextStoreMirrorRegistrationChange,
  ) => void;
};

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

const SWAP_COLD_START_CACHE_KEYS = [
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTipsStateAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapBalanceDisplayCacheAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockBalanceDisplayCacheAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProSelectTokenAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom,
];

function hasSwapColdStartSnapshotForScope(coldStartScopeKey: string) {
  if (!platformEnv.isNative && !platformEnv.isDesktop) {
    return false;
  }

  const snapshot = getColdStartSnapshot();
  if (!snapshot) {
    return false;
  }

  const scopePrefix = `${coldStartScopeKey}${COLD_START_SCOPED_KEY_SEPARATOR}`;
  return Object.keys(snapshot).some(
    (key) =>
      key.startsWith(scopePrefix) &&
      SWAP_COLD_START_CACHE_KEYS.some((cacheKey) =>
        key.endsWith(`${COLD_START_SCOPED_KEY_SEPARATOR}${cacheKey}`),
      ),
  );
}

function hasSwapColdStartSnapshot() {
  return (
    hasSwapColdStartSnapshotForScope(SWAP_COLD_START_SCOPE_KEY) ||
    hasAllNetworkHomeSelectedAccountSnapshot()
  );
}

// AccountSelectorMapTracker
export function JotaiContextStoreMirrorTracker({
  onRegistrationChange,
  ...data
}: IJotaiContextStoreMirrorTrackerProps) {
  const { storeName, accountSelectorInfo } = data;
  const { setMap } = useJotaiContextTrackerMap();
  const storeId = buildJotaiContextStoreId(data);
  useEffect(() => {
    const processMapCount = (action: 'add' | 'remove') => {
      const toMergeMap: IJotaiContextStoreMap = {};

      const mapCache = getJotaiContextTrackerMap();

      const key = storeId;
      let value: IJotaiContextStoreMapValue | undefined = mapCache[key]
        ? {
            ...mapCache[key],
            accountSelectorInfo: mapCache[key].accountSelectorInfo
              ? { ...mapCache[key].accountSelectorInfo }
              : undefined,
          }
        : undefined;
      if (!value) {
        value = {
          storeName,
          accountSelectorInfo,
          count: 0,
        };
      }
      if (action === 'add') {
        value.count += 1;
      }
      if (action === 'remove') {
        value.count -= 1;
      }
      if (accountSelectorInfo && value.accountSelectorInfo) {
        let enabledNumCounts = accountSelectorEnabledNumCounts.get(key);
        if (!enabledNumCounts) {
          enabledNumCounts = new Map<number, number>();
          accountSelectorEnabledNumCounts.set(key, enabledNumCounts);
        }
        accountSelectorInfo.enabledNum.forEach((num) => {
          const nextCount =
            (enabledNumCounts?.get(num) || 0) + (action === 'add' ? 1 : -1);
          if (nextCount <= 0) {
            enabledNumCounts?.delete(num);
          } else {
            enabledNumCounts?.set(num, nextCount);
          }
        });
        // The counts only cover mounts of this runtime, while the map they are
        // written into is shared across runtimes. On single UI runtime targets
        // that is the whole picture, so a count-based shrink is accurate. An
        // extension can run several UI runtimes (popup, side panel, expand
        // tab) at once, so its local counts cannot represent the global
        // picture: publish only on add, and only as a union with the already
        // published enabledNum — replacing it with local keys after a local
        // unmount would erase nums other runtimes still need.
        if (action === 'add' || !platformEnv.isExtension) {
          const localEnabledNum = [...enabledNumCounts.keys()];
          const nextEnabledNum = platformEnv.isExtension
            ? [
                ...new Set([
                  ...value.accountSelectorInfo.enabledNum,
                  ...localEnabledNum,
                ]),
              ]
            : localEnabledNum;
          value.accountSelectorInfo = {
            ...value.accountSelectorInfo,
            enabledNum: nextEnabledNum.toSorted((a, b) => a - b),
          };
        }
      }
      if (value.count <= 0) {
        delete mapCache[key];
        accountSelectorEnabledNumCounts.delete(key);
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
      onRegistrationChange?.({
        action,
        registrationCount: Math.max(0, value.count),
        storeId,
      });
    };

    processMapCount('add');

    return () => {
      processMapCount('remove');
    };
  }, [accountSelectorInfo, onRegistrationChange, setMap, storeId, storeName]);

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
