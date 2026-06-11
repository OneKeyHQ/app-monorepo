/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback } from 'react';

import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export enum EJotaiContextStoreNames {
  accountSelector = 'accountSelector',
  homeAccountOverview = 'homeAccountOverview',
  urlAccountOverview = 'urlAccountOverview',
  urlAccountHomeTokenList = 'urlAccountHomeTokenList',
  homeTokenList = 'homeTokenList',
  discoveryBrowser = 'discoveryBrowser',
  swap = 'swap',
  swapModal = 'swapModal',
  marketSwapReview = 'marketSwapReview',
  marketWatchList = 'marketWatchList',
  marketWatchListV2 = 'marketWatchListV2',
  universalSearch = 'universalSearch',
  earn = 'earn',
  sendConfirm = 'sendConfirm',
  signatureConfirm = 'signatureConfirm',
  perps = 'perps',
}
export type IJotaiContextStoreData = {
  storeName: EJotaiContextStoreNames;
  accountSelectorInfo?: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    enabledNum: number[];
  };
};
export type IJotaiContextStoreMapValue = IJotaiContextStoreData & {
  count: number; // provider mirror counts
};
export type IJotaiContextStoreMap = {
  // check buildJotaiContextStoreId()
  [storeId: string]: IJotaiContextStoreMapValue;
};
export const {
  target: jotaiContextStoreMapAtom,
  use: useJotaiContextStoreMapAtom,
} = globalAtom<IJotaiContextStoreMap>({
  name: EAtomNames.jotaiContextStoreMapAtom,
  initialValue: {},
});

let memoMap: IJotaiContextStoreMap = {};

// UI-local subscribers for the tracker map. `jotaiContextStoreMapAtom` is a
// cross-runtime globalAtom whose write goes through a background `setAtomValue`
// RPC; under cold-start navigation churn the sync-back can fail to re-render the
// UI subscriber (JotaiContextRootProvidersAutoMount), so a newly-added store's
// root provider never mounts (e.g. Perps->Swap Swap white screen). `memoMap` is
// the UI-local source of truth and is updated synchronously on every write, so
// the auto-mount reads it via useSyncExternalStore and these listeners guarantee
// a synchronous, same-runtime re-render independent of the cross-runtime atom.
const trackerMapListeners = new Set<() => void>();

export function subscribeJotaiContextTrackerMap(listener: () => void) {
  trackerMapListeners.add(listener);
  return () => {
    trackerMapListeners.delete(listener);
  };
}

export function useJotaiContextTrackerMap() {
  const [, setMap] = useJotaiContextStoreMapAtom();

  const setMapFinal = useCallback(
    (mapUpdate: IJotaiContextStoreMap) => {
      memoMap = mapUpdate;
      // Notify UI-local subscribers synchronously so the auto-mount reliably
      // re-renders within this runtime; do NOT rely on the cross-runtime
      // globalAtom sync-back below for mounting.
      trackerMapListeners.forEach((listener) => listener());
      setMap(mapUpdate);
    },
    [setMap],
  );
  return { setMap: setMapFinal };
}

export function getJotaiContextTrackerMap() {
  return memoMap;
}
