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

  return (ownerKey: string, currency: string): boolean => {
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
          if (fiat && fiat.currency === currency) changedFiatById[key] = fiat;
          else complete = false;
        }
      }
      for (const [key, networks] of Object.entries(structure.aggMembership)) {
        changedAggFiat[key] = {};
        for (const network of networks) {
          const fiatAtom = projection.aggSubCells.get(key)?.get(network);
          const fiat = fiatAtom && store.get(fiatAtom);
          if (fiat && fiat.currency === currency)
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
}
