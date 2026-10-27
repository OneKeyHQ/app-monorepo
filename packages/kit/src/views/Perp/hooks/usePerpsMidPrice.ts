import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { atom, useAtomValue } from 'jotai';

import {
  perpsActiveAssetCtxAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxMidPriceBySource,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useHyperliquidActions,
  usePerpsMidByCoin,
} from '../../../states/jotai/contexts/hyperliquid';

type IPerpsMidPriceSource = 'live' | 'display';

export function usePerpsMidPrice({
  coin,
  source = 'live',
  szDecimals,
  allowActiveAssetFallback = false,
}: {
  coin: string;
  source?: IPerpsMidPriceSource;
  szDecimals?: number;
  allowActiveAssetFallback?: boolean;
}): {
  mid: string | undefined;
  midFormattedByDecimals: string | undefined;
} {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const actions = useHyperliquidActions();
  const shouldUseDisplayMid = source === 'display' && activeAsset.coin === coin;
  const liveMid = usePerpsMidByCoin(shouldUseDisplayMid ? '' : coin);
  const displayMid = usePerpsActiveAssetCtxMidPriceBySource(
    shouldUseDisplayMid ? 'display' : 'disabled',
  );
  const fallbackMid = useAtomValue(
    useMemo(
      () =>
        atom((get) => {
          if (
            !allowActiveAssetFallback ||
            source !== 'live' ||
            activeAsset.coin !== coin
          ) {
            return undefined;
          }
          const assetCtx = get(perpsActiveAssetCtxAtom.atom());
          return assetCtx?.coin === coin ? assetCtx.ctx.midPrice : undefined;
        }),
      [activeAsset.coin, allowActiveAssetFallback, coin, source],
    ),
  );
  const activeAssetSzDecimals =
    activeAsset.coin === coin ? activeAsset.universe?.szDecimals : undefined;
  const requestedSzDecimals = szDecimals ?? activeAssetSzDecimals;
  const { result: cachedSzDecimals } = usePromiseResult(
    async () => {
      if (requestedSzDecimals !== undefined) {
        return requestedSzDecimals;
      }
      if (!coin) {
        return undefined;
      }
      return actions.current.getTokenSzDecimals({ coin });
    },
    [actions, coin, requestedSzDecimals],
    {
      undefinedResultIfError: true,
    },
  );
  const effectiveSzDecimals =
    requestedSzDecimals ?? cachedSzDecimals ?? undefined;
  const primaryMid = shouldUseDisplayMid ? displayMid : liveMid;

  return useMemo(() => {
    const primaryValue = new BigNumber(primaryMid || '');
    const mid =
      primaryValue.isFinite() && primaryValue.gt(0) ? primaryMid : fallbackMid;
    const midValue = new BigNumber(mid || '');
    if (!midValue.isFinite() || midValue.isLessThanOrEqualTo(0)) {
      return { mid: undefined, midFormattedByDecimals: undefined };
    }

    return {
      mid,
      midFormattedByDecimals: formatPriceToSignificantDigits(
        mid,
        effectiveSzDecimals,
      ),
    };
  }, [effectiveSzDecimals, primaryMid, fallbackMid]);
}
