import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { useMarketDetailDisplayData } from './useMarketDetailDisplayData';

function normalizeIdentity(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

export function getTopCoinsAssetIdCandidates({
  marketTokenId,
  symbol,
}: {
  marketTokenId?: string;
  symbol?: string;
}) {
  return Array.from(
    new Set(
      [marketTokenId, normalizeIdentity(symbol)].filter(
        (assetId): assetId is string => Boolean(assetId),
      ),
    ),
  );
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

export function useTopCoinsDetail(marketTokenId?: string) {
  const { tokenDetail } = useMarketDetailDisplayData();
  const symbol = tokenDetail?.symbol;

  const { result: assetDetail, isLoading: isAssetDetailLoading } =
    usePromiseResult<IMarketAssetDetailData | undefined>(
      async () => {
        const assetIds = getTopCoinsAssetIdCandidates({
          marketTokenId,
          symbol,
        });
        if (!assetIds.length) {
          return undefined;
        }
        let lastError: unknown;
        for (const assetId of assetIds) {
          try {
            return await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail(
              {
                assetId,
                currency: 'usd',
              },
            );
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError instanceof Error
          ? lastError
          : new Error('Failed to fetch the market asset detail');
      },
      [marketTokenId, symbol],
      {
        checkIsFocused: false,
        watchLoading: true,
      },
    );

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
    assetDetail,
    earnAsset,
    isAssetDetailLoading,
  };
}
