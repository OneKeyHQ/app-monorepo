import { isEqual } from 'lodash';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';

import { listStructureAtom, riskyListFrameAtom } from '../atoms';

import {
  applyRiskyFrame,
  applyStructureSnapshot,
  applyValuationFrame,
} from './apply';
import { ensureStoreProjection } from './projection';

import type { IApplyDeps, IRiskyListFrameValue } from './apply';
import type { IJotaiContextStore } from '../../../utils/createJotaiContext';
import type { IAccountSelectorActiveAccountInfo } from '../../accountSelector';

// Main-runtime display snapshots only. The BG ViewModel still owns live data.
const MAX_CACHED_OWNERS = 4;

export function createTokenListOwnerCache(
  store: IJotaiContextStore,
  deps: IApplyDeps,
  storeData: IJotaiContextStoreData,
) {
  const snapshots = new Map<
    string,
    {
      structure: IStructureSnapshot;
      valuation: IValuationFrame;
      risky: IRiskyListFrameValue;
    }
  >();

  const restore = (ownerKey: string, currency: string): boolean => {
    const projection = ensureStoreProjection(store);
    if (!ownerKey || !currency || ownerKey === projection.curOwnerKey) {
      return false;
    }
    const cacheKey = `${currency}:${ownerKey}`;
    const snapshot = snapshots.get(cacheKey);
    if (snapshot) {
      snapshots.delete(cacheKey);
      snapshots.set(cacheKey, snapshot);
    }
    const structure = store.get(listStructureAtom());
    if (structure.ownerKey && projection.curGeneration >= 0) {
      const metaPatch: IStructureSnapshot['metaPatch'] = {};
      const changedFiatById: IValuationFrame['changedFiatById'] = {};
      const changedAggFiat: IValuationFrame['changedAggFiat'] = {};
      let complete = true;
      for (const key of [
        ...structure.orderedIds,
        ...structure.smallBalanceIds,
      ]) {
        const token = projection.metas.get(key);
        const value = token && store.get(token);
        if (value) metaPatch[key] = value;
        else complete = false;
        if (!deps.isAgg(key, value)) {
          const fiatAtom = projection.cells.get(key);
          const fiat = fiatAtom && store.get(fiatAtom);
          if (fiat && (fiat.currency === 'usd' || fiat.currency === currency))
            changedFiatById[key] = fiat;
          else complete = false;
        }
      }
      for (const [key, networks] of Object.entries(structure.aggMembership)) {
        changedAggFiat[key] = {};
        for (const network of networks) {
          const fiatAtom = projection.aggSubCells.get(key)?.get(network);
          const fiat = fiatAtom && store.get(fiatAtom);
          if (fiat && (fiat.currency === 'usd' || fiat.currency === currency))
            changedAggFiat[key][network] = fiat;
          else complete = false;
        }
      }
      if (complete) {
        const previousCacheKey = `${currency}:${structure.ownerKey}`;
        snapshots.delete(previousCacheKey);
        snapshots.set(previousCacheKey, {
          structure: { ...structure, metaPatch, storeData },
          valuation: {
            changedFiatById,
            changedAggFiat,
            ownerKey: structure.ownerKey,
            storeData,
          },
          risky: store.get(riskyListFrameAtom()),
        });
        if (snapshots.size > MAX_CACHED_OWNERS) {
          const oldestKey = snapshots.keys().next().value;
          if (oldestKey) snapshots.delete(oldestKey);
        }
      }
    }
    if (!snapshot) return false;
    applyStructureSnapshot(store, projection, snapshot.structure, deps);
    // Normal cells have no mounted leaves yet for newly appearing tokens.
    for (const key of Object.keys(snapshot.valuation.changedFiatById)) {
      deps.cell(store, key);
    }
    applyValuationFrame(store, projection, snapshot.valuation, deps, (fn) =>
      fn(),
    );
    if (snapshot.risky.ownerKey === ownerKey) {
      applyRiskyFrame(store, { ...snapshot.risky, storeData }, deps);
    }
    // BG can evict an inactive owner and restart its generation at zero.
    // A display snapshot must never block that owner's next live structure.
    projection.curGeneration = -1;
    return true;
  };
  return Object.assign(restore, {
    has: (ownerKey: string, currency: string) =>
      snapshots.has(`${currency}:${ownerKey}`),
    seed: (
      ownerKey: string,
      currency: string,
      snapshot: {
        structure: IStructureSnapshot;
        valuation: IValuationFrame;
        risky: IRiskyListFrameValue;
      },
    ) => {
      snapshots.set(`${currency}:${ownerKey}`, snapshot);
      if (snapshots.size > MAX_CACHED_OWNERS) {
        const oldest = snapshots.keys().next().value;
        if (oldest) snapshots.delete(oldest);
      }
    },
  });
}

type IHomeSwitchPreparer = (
  target: IAccountSelectorActiveAccountInfo,
  signal: AbortSignal,
) => Promise<(() => void) | undefined>;
let homeSwitchPreparer: IHomeSwitchPreparer | undefined;
let activeHomeSwitch: AbortController | undefined;
let pendingHomeSwitch:
  | {
      target: IAccountSelectorActiveAccountInfo;
      controller: AbortController;
      result: Promise<(() => void) | undefined>;
    }
  | undefined;

export function registerHomeTokenListPreparer(prepare: IHomeSwitchPreparer) {
  activeHomeSwitch?.abort();
  pendingHomeSwitch = undefined;
  homeSwitchPreparer = prepare;
  return () => {
    if (homeSwitchPreparer === prepare) {
      homeSwitchPreparer = undefined;
      activeHomeSwitch?.abort();
      pendingHomeSwitch = undefined;
    }
  };
}

export async function prepareHomeTokenListSwitch(
  target: IAccountSelectorActiveAccountInfo,
) {
  if (pendingHomeSwitch && isEqual(pendingHomeSwitch.target, target)) {
    return pendingHomeSwitch.result;
  }
  activeHomeSwitch?.abort();
  const prepare = homeSwitchPreparer;
  if (!prepare) return undefined;
  const controller = new AbortController();
  activeHomeSwitch = controller;
  const result = (async () => {
    let onAbort: (() => void) | undefined;
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const commit = await Promise.race([
        prepare(target, controller.signal),
        new Promise<undefined>((resolve) => {
          onAbort = () => resolve(undefined);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
      if (controller.signal.aborted || !commit) return undefined;
      let committed = false;
      return () => {
        if (!controller.signal.aborted && !committed) {
          committed = true;
          commit();
        }
      };
    } finally {
      clearTimeout(timeout);
      if (onAbort) controller.signal.removeEventListener('abort', onAbort);
    }
  })();
  pendingHomeSwitch = { target, controller, result };
  try {
    return await result;
  } finally {
    if (pendingHomeSwitch?.controller === controller) {
      pendingHomeSwitch = undefined;
    }
  }
}
