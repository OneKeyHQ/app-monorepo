import { memo, useEffect, useMemo, useRef } from 'react';

import type {
  IJotaiContextStoreData,
  IJotaiContextStoreMap,
  IJotaiContextStoreMapValue,
  IJotaiContextStoreRegistrationUpdate,
  IJotaiContextStoreRuntimeRegistration,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EJotaiContextStoreNames,
  JOTAI_CONTEXT_STORE_REGISTRATION_HEARTBEAT_MS,
  getJotaiContextTrackerMap,
  useJotaiContextStoreMapAtom,
  useJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
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
let nextMirrorRegistrationId = 0;
const extensionRuntimeRegistrations = new Map<
  string,
  IJotaiContextStoreRuntimeRegistration
>();
let extensionRuntimeRegistrationRevision = 0;
let extensionRuntimeRegistrationUpdateQueue = Promise.resolve();
let extensionRuntimeRegistrationHeartbeat:
  | ReturnType<typeof setInterval>
  | undefined;

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

function enqueueExtensionRuntimeRegistrationSnapshot({
  changeAction,
  onRegistrationChange,
  storeId,
}: {
  changeAction?: 'add' | 'remove';
  onRegistrationChange?: (
    change: IJotaiContextStoreMirrorRegistrationChange,
  ) => void;
  storeId: string;
}) {
  extensionRuntimeRegistrationRevision += 1;
  const update: IJotaiContextStoreRegistrationUpdate = {
    action: 'reconcile-runtime',
    registrations: [...extensionRuntimeRegistrations.values()],
    revision: extensionRuntimeRegistrationRevision,
    runtimeId: appEventBus.nodeId,
    storeId,
  };
  extensionRuntimeRegistrationUpdateQueue =
    extensionRuntimeRegistrationUpdateQueue
      .catch(() => undefined)
      .then(async () => {
        const { default: backgroundApiProxy } =
          await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
        const result =
          await backgroundApiProxy.updateJotaiContextStoreRegistration(update);
        if (changeAction === 'remove' && result.registrationCount <= 0) {
          jotaiContextStore.completeStoreResetIfRequestedById(storeId);
        }
        if (changeAction) {
          onRegistrationChange?.({
            action: changeAction,
            registrationCount: result.registrationCount,
            storeId,
          });
        }
      })
      .catch((error: unknown) => {
        console.error(
          'Failed to reconcile the Jotai context store registrations',
          error,
        );
      });
}

function updateExtensionRuntimeRegistrationHeartbeat() {
  if (
    extensionRuntimeRegistrations.size > 0 &&
    !extensionRuntimeRegistrationHeartbeat
  ) {
    extensionRuntimeRegistrationHeartbeat = setInterval(() => {
      const firstRegistration = extensionRuntimeRegistrations.values().next()
        .value as IJotaiContextStoreRuntimeRegistration | undefined;
      if (firstRegistration) {
        enqueueExtensionRuntimeRegistrationSnapshot({
          storeId: firstRegistration.storeId,
        });
      }
    }, JOTAI_CONTEXT_STORE_REGISTRATION_HEARTBEAT_MS);
  } else if (
    extensionRuntimeRegistrations.size === 0 &&
    extensionRuntimeRegistrationHeartbeat
  ) {
    clearInterval(extensionRuntimeRegistrationHeartbeat);
    extensionRuntimeRegistrationHeartbeat = undefined;
  }
}

// AccountSelectorMapTracker
export function JotaiContextStoreMirrorTracker({
  onRegistrationChange,
  ...data
}: IJotaiContextStoreMirrorTrackerProps) {
  const { storeName, accountSelectorInfo } = data;
  const { setMap } = useJotaiContextTrackerMap();
  const storeId = buildJotaiContextStoreId(data);
  const registrationIdRef = useRef<string | undefined>(undefined);
  if (!registrationIdRef.current) {
    nextMirrorRegistrationId += 1;
    registrationIdRef.current = `${appEventBus.nodeId}:${nextMirrorRegistrationId}`;
  }
  useEffect(() => {
    if (platformEnv.isExtensionUi) {
      const registrationId = registrationIdRef.current as string;
      extensionRuntimeRegistrations.set(registrationId, {
        data: { accountSelectorInfo, storeName },
        registrationId,
        storeId,
      });
      updateExtensionRuntimeRegistrationHeartbeat();
      enqueueExtensionRuntimeRegistrationSnapshot({
        changeAction: 'add',
        onRegistrationChange,
        storeId,
      });
      return () => {
        extensionRuntimeRegistrations.delete(registrationId);
        updateExtensionRuntimeRegistrationHeartbeat();
        enqueueExtensionRuntimeRegistrationSnapshot({
          changeAction: 'remove',
          onRegistrationChange,
          storeId,
        });
      };
    }

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
        value.accountSelectorInfo = {
          ...value.accountSelectorInfo,
          enabledNum: [...enabledNumCounts.keys()].toSorted((a, b) => a - b),
        };
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
