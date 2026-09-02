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
export const JOTAI_CONTEXT_STORE_REGISTRATION_HEARTBEAT_MS = 20_000;
// Hidden extension tabs may only run chained timers once per minute. Keep the
// lease beyond two throttled heartbeat slots so another active runtime cannot
// prune a live tab before its delayed heartbeat runs.
export const JOTAI_CONTEXT_STORE_REGISTRATION_LEASE_MS = 150_000;

export type IJotaiContextStoreRuntimeRegistration = {
  data: IJotaiContextStoreData;
  registrationId: string;
  storeId: string;
};
export type IJotaiContextStoreRegistrationUpdate =
  | (IJotaiContextStoreRuntimeRegistration & {
      action: 'add' | 'remove';
      revision: number;
      runtimeId?: string;
    })
  | {
      action: 'reconcile-runtime';
      registrations: IJotaiContextStoreRuntimeRegistration[];
      revision: number;
      runtimeId: string;
      // The initiating mirror's store, used only to return its aggregate count.
      storeId: string;
    };
export type IJotaiContextStoreRegistrationUpdateResult = {
  map: IJotaiContextStoreMap;
  mapChanged: boolean;
  registrationCount: number;
};

type IJotaiContextStoreRegistration = {
  data: IJotaiContextStoreData;
  expiresAt: number;
  revision: number;
  runtimeId: string;
  storeId: string;
};

export class JotaiContextStoreRegistrationRegistry {
  private readonly registrations = new Map<
    string,
    IJotaiContextStoreRegistration
  >();

  private readonly runtimeRevisions = new Map<string, number>();

  private lastMapFingerprint = JSON.stringify({});

  constructor(
    private readonly options: {
      leaseMs?: number;
      now?: () => number;
    } = {},
  ) {}

  private get leaseMs() {
    return this.options.leaseMs ?? JOTAI_CONTEXT_STORE_REGISTRATION_LEASE_MS;
  }

  private get now() {
    return this.options.now ?? Date.now;
  }

  private pruneExpired(now: number) {
    for (const [registrationId, registration] of this.registrations) {
      if (registration.expiresAt <= now) {
        this.registrations.delete(registrationId);
      }
    }
  }

  private buildMap(): IJotaiContextStoreMap {
    const map: IJotaiContextStoreMap = {};
    const registrations = [...this.registrations.entries()].toSorted(
      ([registrationIdA], [registrationIdB]) =>
        registrationIdA.localeCompare(registrationIdB),
    );
    for (const [, { data, storeId }] of registrations) {
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
    const now = this.now();
    this.pruneExpired(now);
    if (update.action === 'reconcile-runtime') {
      const latestRuntimeRevision =
        this.runtimeRevisions.get(update.runtimeId) ?? -1;
      if (update.revision > latestRuntimeRevision) {
        for (const [registrationId, registration] of this.registrations) {
          if (registration.runtimeId === update.runtimeId) {
            this.registrations.delete(registrationId);
          }
        }
        update.registrations.forEach((registration) => {
          this.registrations.set(registration.registrationId, {
            data: {
              ...registration.data,
              accountSelectorInfo: registration.data.accountSelectorInfo
                ? {
                    ...registration.data.accountSelectorInfo,
                    enabledNum: [
                      ...registration.data.accountSelectorInfo.enabledNum,
                    ],
                  }
                : undefined,
            },
            expiresAt: now + this.leaseMs,
            revision: update.revision,
            runtimeId: update.runtimeId,
            storeId: registration.storeId,
          });
        });
        this.runtimeRevisions.set(update.runtimeId, update.revision);
      } else if (update.revision === latestRuntimeRevision) {
        for (const registration of this.registrations.values()) {
          if (registration.runtimeId === update.runtimeId) {
            registration.expiresAt = now + this.leaseMs;
          }
        }
      }
    } else {
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
            expiresAt: now + this.leaseMs,
            revision: update.revision,
            runtimeId:
              update.runtimeId ?? update.registrationId.split(':')[0] ?? '',
            storeId: update.storeId,
          });
        } else {
          this.registrations.delete(update.registrationId);
        }
      }
    }

    const map = this.buildMap();
    const mapFingerprint = JSON.stringify(map);
    const mapChanged = mapFingerprint !== this.lastMapFingerprint;
    this.lastMapFingerprint = mapFingerprint;
    return {
      map,
      mapChanged,
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
    if (result.mapChanged) {
      await jotaiContextStoreMapAtom.set(result.map);
    }
    return result;
  });
  backgroundRegistrationUpdateQueue = updateTask.then(
    () => undefined,
    () => undefined,
  );
  return updateTask;
}
