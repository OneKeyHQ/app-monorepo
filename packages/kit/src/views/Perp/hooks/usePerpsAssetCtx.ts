import { useEffect, useMemo } from 'react';

import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFormattedAssetCtx } from '@onekeyhq/shared/types/hyperliquid';

import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpsAllAssetCtxsAtom } from '../../../states/jotai/contexts/hyperliquid/atoms';

export function usePerpsAssetCtx({ assetId }: { assetId: number }): {
  assetCtx: IPerpsFormattedAssetCtx;
  isLoading: boolean;
} {
  const [{ assetCtxs: allAssetCtxs }] = usePerpsAllAssetCtxsAtom();
  const actions = useHyperliquidActions();
  const assetCtx: IPerpsFormattedAssetCtx = useMemo<IPerpsFormattedAssetCtx>(
    () => perpsUtils.formatAssetCtx(allAssetCtxs[assetId]) || undefined,
    [allAssetCtxs, assetId],
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
