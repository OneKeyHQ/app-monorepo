import { useEffect, useMemo } from 'react';

import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetCtx,
  IPerpsFormattedAssetCtx,
} from '@onekeyhq/shared/types/hyperliquid';
import {
  XYZ_ASSET_ID_LENGTH,
  XYZ_ASSET_ID_OFFSET,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpsAllAssetCtxsAtom } from '../../../states/jotai/contexts/hyperliquid/atoms';

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
  if (assetId == null) {
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
}: {
  assetId: number;
  dexIndex?: number;
}): {
  assetCtx: IPerpsFormattedAssetCtx;
  isLoading: boolean;
} {
  const [{ assetCtxsByDex }] = usePerpsAllAssetCtxsAtom();
  const { dexIndex: resolvedDexIndex, ctxIndex } = useMemo(
    () => normalizeCtxIndex(assetId, dexIndex),
    [assetId, dexIndex],
  );
  const allAssetCtxs = useMemo(
    () => assetCtxsByDex[resolvedDexIndex] || [],
    [assetCtxsByDex, resolvedDexIndex],
  );
  const ctxAtIndex: IPerpsAssetCtx | null =
    ctxIndex >= 0 && ctxIndex < allAssetCtxs.length
      ? allAssetCtxs[ctxIndex]
      : null;
  const ctxSafe = ctxAtIndex ?? null;
  const actions = useHyperliquidActions();
  const assetCtx: IPerpsFormattedAssetCtx = useMemo<IPerpsFormattedAssetCtx>(
    () => perpsUtils.formatAssetCtx(ctxSafe) || undefined,
    [ctxSafe],
  );
  const isLoading = useMemo(() => allAssetCtxs.length <= 0, [allAssetCtxs]);
  useEffect(() => {
    actions.current.markAllAssetCtxsRequired();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      actions.current.markAllAssetCtxsNotRequired();
    };
  }, [actions]);
  return { assetCtx, isLoading };
}
