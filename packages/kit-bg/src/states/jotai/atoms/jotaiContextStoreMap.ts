/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback } from 'react';

import { useSetAtom } from 'jotai';

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
export type IJotaiContextStoreRegistrationUpdate = {
  action: 'add' | 'remove';
  data: IJotaiContextStoreData;
  registrationId: string;
  revision: number;
  storeId: string;
};
export type IJotaiContextStoreRegistrationUpdateResult = {
  map: IJotaiContextStoreMap;
  registrationCount: number;
};

type IJotaiContextStoreRegistration = {
  data: IJotaiContextStoreData;
  revision: number;
  storeId: string;
};

export class JotaiContextStoreRegistrationRegistry {
  private readonly registrations = new Map<
    string,
    IJotaiContextStoreRegistration
  >();

  private buildMap(): IJotaiContextStoreMap {
    const map: IJotaiContextStoreMap = {};
    for (const { data, storeId } of this.registrations.values()) {
      const current = map[storeId];
      const enabledNum = new Set([
        ...(current?.accountSelectorInfo?.enabledNum ?? []),
        ...(data.accountSelectorInfo?.enabledNum ?? []),
      ]);
      map[storeId] = {
        storeName: data.storeName,
        accountSelectorInfo: data.accountSelectorInfo
          ? {
              ...data.accountSelectorInfo,
              enabledNum: [...enabledNum].toSorted((a, b) => a - b),
            }
          : current?.accountSelectorInfo,
        count: (current?.count ?? 0) + 1,
      };
    }
    return map;
  }

  update(
    update: IJotaiContextStoreRegistrationUpdate,
  ): IJotaiContextStoreRegistrationUpdateResult {
    const latestRevision =
      this.registrations.get(update.registrationId)?.revision ?? -1;
    if (update.revision > latestRevision) {
      if (update.action === 'add') {
        this.registrations.set(update.registrationId, {
          data: {
            ...update.data,
            accountSelectorInfo: update.data.accountSelectorInfo
              ? {
                  ...update.data.accountSelectorInfo,
                  enabledNum: [...update.data.accountSelectorInfo.enabledNum],
                }
              : undefined,
          },
          revision: update.revision,
          storeId: update.storeId,
        });
      } else {
        this.registrations.delete(update.registrationId);
      }
    }

    const map = this.buildMap();
    return {
      map,
      registrationCount: map[update.storeId]?.count ?? 0,
    };
  }
}

export const {
  target: jotaiContextStoreMapAtom,
  use: useJotaiContextStoreMapAtom,
} = globalAtom<IJotaiContextStoreMap>({
  name: EAtomNames.jotaiContextStoreMapAtom,
  initialValue: {},
});

let memoMap: IJotaiContextStoreMap = {};

export function syncJotaiContextTrackerMap(map: IJotaiContextStoreMap) {
  memoMap = map;
}

export function useJotaiContextTrackerMap() {
  const setMap = useSetAtom(jotaiContextStoreMapAtom.atom());

  const setMapFinal = useCallback(
    (mapUpdate: IJotaiContextStoreMap) => {
      syncJotaiContextTrackerMap(mapUpdate);
      setMap(mapUpdate);
    },
    [setMap],
  );
  return { setMap: setMapFinal };
}

export function getJotaiContextTrackerMap() {
  return memoMap;
}

const backgroundRegistrationRegistry =
  new JotaiContextStoreRegistrationRegistry();
let backgroundRegistrationUpdateQueue = Promise.resolve();

export function updateJotaiContextStoreRegistration(
  update: IJotaiContextStoreRegistrationUpdate,
): Promise<IJotaiContextStoreRegistrationUpdateResult> {
  const updateTask = backgroundRegistrationUpdateQueue.then(async () => {
    const result = backgroundRegistrationRegistry.update(update);
    syncJotaiContextTrackerMap(result.map);
    await jotaiContextStoreMapAtom.set(result.map);
    return result;
  });
  backgroundRegistrationUpdateQueue = updateTask.then(
    () => undefined,
    () => undefined,
  );
  return updateTask;
}
