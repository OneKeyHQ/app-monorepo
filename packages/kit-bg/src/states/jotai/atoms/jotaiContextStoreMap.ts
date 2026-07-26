/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IJotaiAtomSetWithoutProxy } from '../types';

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
const jotaiContextStoreMapCrossAtom = globalAtom<IJotaiContextStoreMap>({
  name: EAtomNames.jotaiContextStoreMapAtom,
  initialValue: {},
});
export const jotaiContextStoreMapAtom = jotaiContextStoreMapCrossAtom.target;

export function useJotaiContextStoreMapAtom() {
  const [map, setMap] = jotaiContextStoreMapCrossAtom.use();
  const setMapWithNativeLocalUpdate = setMap as typeof setMap &
    ((
      update: IJotaiAtomSetWithoutProxy<IJotaiContextStoreMap>,
    ) => void | Promise<void>);
  const setMapRef = useRef(setMapWithNativeLocalUpdate);
  useEffect(() => {
    setMapRef.current = setMapWithNativeLocalUpdate;
  }, [setMapWithNativeLocalUpdate]);
  const setMapStable = useCallback(
    (
      update:
        | IJotaiContextStoreMap
        | IJotaiAtomSetWithoutProxy<IJotaiContextStoreMap>,
    ) =>
      (
        setMapRef.current as (
          value:
            | IJotaiContextStoreMap
            | IJotaiAtomSetWithoutProxy<IJotaiContextStoreMap>,
        ) => void | Promise<void>
      )(update),
    [],
  ) as typeof setMapWithNativeLocalUpdate;
  return [map, setMapStable] as const;
}

let memoMap: IJotaiContextStoreMap = {};

function settleMapWrite(writeResult: void | Promise<void>) {
  // Native UI-to-bg writes can reject while the background transport is still
  // starting. The ready-signal replay owns recovery, so consume that rejection.
  void Promise.resolve(writeResult).catch(() => undefined);
}

function buildNativeMainLocalMapUpdate(
  mapUpdate: IJotaiContextStoreMap,
): IJotaiAtomSetWithoutProxy<IJotaiContextStoreMap> {
  return {
    $$isForceSetAtomWithoutProxy: true,
    name: EAtomNames.jotaiContextStoreMapAtom,
    payload: mapUpdate,
  };
}

export function useJotaiContextTrackerMap() {
  const [, setMap] = useJotaiContextStoreMapAtom();
  const setMapRef = useRef(setMap);
  useEffect(() => {
    setMapRef.current = setMap;
  }, [setMap]);

  const setMapFinal = useCallback((mapUpdate: IJotaiContextStoreMap) => {
    memoMap = mapUpdate;
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      // Provider registration is a main-runtime rendering fact. Publish it
      // locally before syncing the isolated bg heap so root providers can
      // mount even while the native background transport is still starting.
      settleMapWrite(
        setMapRef.current(buildNativeMainLocalMapUpdate(mapUpdate)),
      );
    }
    settleMapWrite(setMapRef.current(mapUpdate));
  }, []);
  return { setMap: setMapFinal };
}

export function getJotaiContextTrackerMap() {
  return memoMap;
}
