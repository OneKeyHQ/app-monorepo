import { memo, useEffect, useMemo } from 'react';

import { uniq } from 'lodash';

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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { isSwapColdStartAllNetworkContextNetworkId } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';

import { AccountSelectorRootProvider } from '../../../components/AccountSelector/AccountSelectorRootProvider';
import { DiscoveryBrowserRootProvider } from '../../../views/Discovery/components/DiscoveryBrowserRootProvider';
import { EarnProvider } from '../../../views/Earn/EarnProvider';
import { HomeTokenListRootProvider } from '../../../views/Home/components/HomeTokenListProvider/HomeTokenListRootProvider';
import { UrlAccountHomeTokenListProvider } from '../../../views/Home/components/HomeTokenListProvider/UrlAccountHomeTokenListProvider';
import { MarketWatchListProvider } from '../../../views/Market/MarketWatchListProvider';
import { MarketWatchListProviderV2 } from '../../../views/Market/MarketWatchListProviderV2';
import { PerpsRootProvider } from '../../../views/Perp/PerpsProvider';
import { SendConfirmRootProvider } from '../../../views/Send/components/SendConfirmProvider/SendConfirmRootProvider';
import { SignatureConfirmRootProvider } from '../../../views/SignatureConfirm/components/SignatureConfirmProvider/SignatureConfirmRootProvider';
import {
  SwapModalRootProvider,
  SwapRootProvider,
} from '../../../views/Swap/pages/SwapRootProvider';
import { UniversalSearchProvider } from '../../../views/UniversalSearch/pages/UniversalSearchProvider';

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
    <>
      {shouldMountSwapColdStartRootProvider ? <SwapRootProvider /> : null}
      {shouldMountPerpsColdStartRootProvider ? <PerpsRootProvider /> : null}
      {mapEntries.map(([key, value]) => {
        const { accountSelectorInfo, count, storeName } = value;
        // const config = {
        //   sceneName,
        //   sceneUrl,
        // };
        if (count <= 0) {
          return null;
        }

        switch (storeName) {
          case EJotaiContextStoreNames.accountSelector: {
            if (!accountSelectorInfo) {
              throw new OneKeyLocalError(
                'JotaiContextRootProvidersAutoMount ERROR: accountSelectorInfo is required',
              );
            }
            const { sceneName, sceneUrl, enabledNum } = accountSelectorInfo;
            return (
              <AccountSelectorRootProvider
                key={key}
                sceneName={sceneName}
                sceneUrl={sceneUrl}
                enabledNumStr={enabledNum.join(',')}
              />
            );
          }
          case EJotaiContextStoreNames.homeAccountOverview:
          case EJotaiContextStoreNames.urlAccountOverview: {
            // AccountOverview is mounted by page-level root providers, so
            // it does not use global mirror auto-mount here.
            return null;
          }
          case EJotaiContextStoreNames.homeTokenList: {
            return <HomeTokenListRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.urlAccountHomeTokenList: {
            return <UrlAccountHomeTokenListProvider key={key} />;
          }
          case EJotaiContextStoreNames.discoveryBrowser: {
            return <DiscoveryBrowserRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.universalSearch: {
            return <UniversalSearchProvider key={key} />;
          }
          case EJotaiContextStoreNames.marketWatchList: {
            return <MarketWatchListProvider key={key} />;
          }
          case EJotaiContextStoreNames.marketWatchListV2: {
            return <MarketWatchListProviderV2 key={key} />;
          }
          case EJotaiContextStoreNames.swap: {
            if (shouldMountSwapColdStartRootProvider) {
              return null;
            }
            return <SwapRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.swapModal: {
            return <SwapModalRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.marketSwapReview: {
            // Market review owns its local store lifecycle inside the dialog.
            return null;
          }
          case EJotaiContextStoreNames.earn: {
            return <EarnProvider key={key} />;
          }
          case EJotaiContextStoreNames.sendConfirm: {
            return <SendConfirmRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.signatureConfirm: {
            return <SignatureConfirmRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.perps: {
            if (shouldMountPerpsColdStartRootProvider) {
              return null;
            }
            return <PerpsRootProvider key={key} />;
          }
          default: {
            const exhaustiveCheck: never = storeName;
            throw new OneKeyLocalError(
              `Unhandled storeName case: ${exhaustiveCheck as string}`,
            );
          }
        }
      })}
    </>
  );
}

export const JotaiContextRootProvidersAutoMount = memo(
  JotaiContextRootProvidersAutoMountCmp,
);
