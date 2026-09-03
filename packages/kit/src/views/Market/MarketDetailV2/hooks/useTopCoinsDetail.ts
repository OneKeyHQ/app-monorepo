import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { useMarketDetailDisplayData } from './useMarketDetailDisplayData';

function normalizeIdentity(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

export function findTopCoinsEarnAsset({
  assets,
  symbol,
}: {
  assets: IRecommendAsset[];
  symbol?: string;
}) {
  const normalizedSymbol = normalizeIdentity(symbol);
  const exactMatch = assets.find(
    (asset) => normalizeIdentity(asset.symbol) === normalizedSymbol,
  );
  if (exactMatch) {
    return exactMatch;
  }
  if (normalizedSymbol === 'eth') {
    return assets.find((asset) => normalizeIdentity(asset.symbol) === 'weth');
  }
  return undefined;
}

export function useTopCoinsDetail(assetDetail?: IMarketAssetDetailData) {
  const { tokenDetail } = useMarketDetailDisplayData();
  const symbol = tokenDetail?.symbol;

  const { result: earnAssets = [] } = usePromiseResult<IRecommendAsset[]>(
    async () => {
      if (!symbol) {
        return [];
      }
      const response =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2();
      return response?.tokens ?? [];
    },
    [symbol],
    {
      checkIsFocused: false,
      initResult: [],
    },
  );

  const assetSymbol = assetDetail?.asset.symbol ?? symbol;
  const earnAsset = useMemo(
    () => findTopCoinsEarnAsset({ assets: earnAssets, symbol: assetSymbol }),
    [assetSymbol, earnAssets],
  );

  return {
    earnAsset,
  };
}
