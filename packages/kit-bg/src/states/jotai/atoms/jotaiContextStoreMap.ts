/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback } from 'react';

import { isEqual } from 'lodash';

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
  marketSwap = 'marketSwap',
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

// Every Provider mount and unmount rewrites this map, and on split-runtime
// targets each write to the global atom is a request to the background
// runtime. Opening a screen mounts a run of Providers in one commit, so those
// writes arrive as a burst whose intermediate maps nobody reads: consumers in
// this runtime take the map from `getJotaiContextTrackerMap()` synchronously,
// and the atom itself only drives the root Providers rendered from the settled
// map. Send the final map of each batch instead, and nothing at all when a
// Provider mounts and unmounts within the same batch.
let pendingWrite: ((map: IJotaiContextStoreMap) => void) | undefined;
let lastWrittenMap: IJotaiContextStoreMap = memoMap;

function flushContextTrackerMapWrite() {
  const write = pendingWrite;
  pendingWrite = undefined;
  if (!write || isEqual(memoMap, lastWrittenMap)) {
    return;
  }
  lastWrittenMap = memoMap;
  write(memoMap);
}

export function useJotaiContextTrackerMap() {
  const [, setMap] = useJotaiContextStoreMapAtom();

  const setMapFinal = useCallback(
    (mapUpdate: IJotaiContextStoreMap) => {
      memoMap = mapUpdate;
      const wasScheduled = Boolean(pendingWrite);
      // Any instance's setter writes the same global atom; keep the newest so
      // a batch is never flushed through a Provider that has since unmounted.
      pendingWrite = setMap;
      if (!wasScheduled) {
        void Promise.resolve().then(flushContextTrackerMapWrite);
      }
    },
    [setMap],
  );
  return { setMap: setMapFinal };
}

export function getJotaiContextTrackerMap() {
  return memoMap;
}
