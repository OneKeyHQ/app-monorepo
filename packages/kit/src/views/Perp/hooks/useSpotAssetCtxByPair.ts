import { useMemo } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';

import {
  type ISpotAssetCtxEntry,
  spotAssetCtxsMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function isSpotAssetCtxEntryEqual(
  a: ISpotAssetCtxEntry | null,
  b: ISpotAssetCtxEntry | null,
) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.markPx === b.markPx &&
    a.prevDayPx === b.prevDayPx &&
    a.dayNtlVlm === b.dayNtlVlm &&
    a.circulatingSupply === b.circulatingSupply &&
    a.totalSupply === b.totalSupply
  );
}

function createSpotAssetCtxByPairAtom(pairName: string) {
  return selectAtom(
    spotAssetCtxsMapAtom.atom(),
    (
      spotPriceMap,
      prevCtx?: ISpotAssetCtxEntry | null,
    ): ISpotAssetCtxEntry | null => {
      const nextCtx = spotPriceMap[pairName] ?? null;
      if (prevCtx !== undefined && isSpotAssetCtxEntryEqual(prevCtx, nextCtx)) {
        return prevCtx;
      }
      return nextCtx;
    },
  );
}

const spotAssetCtxByPairAtomCache = new Map<
  string,
  ReturnType<typeof createSpotAssetCtxByPairAtom>
>();

function getOrCreateSpotAssetCtxByPairAtom(pairName: string) {
  let entry = spotAssetCtxByPairAtomCache.get(pairName);
  if (!entry) {
    entry = createSpotAssetCtxByPairAtom(pairName);
    spotAssetCtxByPairAtomCache.set(pairName, entry);
  }
  return entry;
}

/**
 * One pair's entry of the spot asset contexts. The map changes with every
 * quote of any pair; this only changes when the pair's own fields do.
 */
export function useSpotAssetCtxByPair(pairName: string) {
  const selectedAtom = useMemo(
    () => getOrCreateSpotAssetCtxByPairAtom(pairName),
    [pairName],
  );
  return useAtomValue(selectedAtom);
}
