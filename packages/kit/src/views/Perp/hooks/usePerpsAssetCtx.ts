import { useEffect, useMemo } from 'react';

import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFormattedAssetCtx } from '@onekeyhq/shared/types/hyperliquid';
import {
  XYZ_ASSET_ID_LENGTH,
  XYZ_ASSET_ID_OFFSET,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpsCtxByCoin } from '../../../states/jotai/contexts/hyperliquid/atoms';

function detectDexByAssetId(assetId: number) {
  const str = `${assetId}`;
  if (str.length === XYZ_ASSET_ID_LENGTH && str.startsWith('11')) {
    return 1;
  }
  return 0;
}

function normalizeCtxIndex(
  assetId: number | undefined,
  dexIndex?: number,
): {
  dexIndex: number;
  ctxIndex: number;
} {
  if (assetId === null || assetId === undefined) {
    return { dexIndex: 0, ctxIndex: -1 };
  }
  const targetDexIndex =
    typeof dexIndex === 'number' ? dexIndex : detectDexByAssetId(assetId);
  const ctxIndex =
    targetDexIndex === 1 ? assetId - XYZ_ASSET_ID_OFFSET : assetId;
  return { dexIndex: targetDexIndex, ctxIndex };
}

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
  const { dexIndex: resolvedDexIndex } = useMemo(
    () => normalizeCtxIndex(assetId, dexIndex),
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
