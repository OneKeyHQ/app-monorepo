import { useEffect, useMemo } from 'react';

import { getDexIndexByAssetId } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFormattedAssetCtx } from '@onekeyhq/shared/types/hyperliquid';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpsCtxByCoin } from '../../../states/jotai/contexts/hyperliquid/atoms';

export function usePerpsAssetCtx({
  assetId,
  dexIndex,
  skipMarkRequired,
}: {
  assetId: number;
  dexIndex?: number;
  skipMarkRequired?: boolean;
}): {
  assetCtx: IPerpsFormattedAssetCtx;
  isLoading: boolean;
} {
  const resolvedDexIndex = useMemo(
    () =>
      typeof dexIndex === 'number' ? dexIndex : getDexIndexByAssetId(assetId),
    [assetId, dexIndex],
  );
  // Per-asset subscription: only re-renders when this asset's fields actually change.
  // selectAtom in getOrCreateCtxByCoinAtom returns the previous reference when
  // field values are equal, so Jotai skips notification and this hook is not called.
  const ctxSafe = usePerpsCtxByCoin(resolvedDexIndex, assetId);
  const actions = useHyperliquidActions();
  const assetCtx: IPerpsFormattedAssetCtx = useMemo<IPerpsFormattedAssetCtx>(
    () => perpsUtils.formatAssetCtx(ctxSafe) || undefined,
    [ctxSafe],
  );
  const isLoading = useMemo(() => ctxSafe === null, [ctxSafe]);
  useEffect(() => {
    if (skipMarkRequired) return;
    actions.current.markAllAssetCtxsRequired();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      actions.current.markAllAssetCtxsNotRequired();
    };
  }, [actions, skipMarkRequired]);
  return { assetCtx, isLoading };
}
