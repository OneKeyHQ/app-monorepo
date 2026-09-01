import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IMarketToken,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { useMarketDetailDisplayData } from './useMarketDetailDisplayData';

function normalizeIdentity(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

export function findTopCoinsMarketTokenCandidate({
  candidates,
  name,
  symbol,
}: {
  candidates: IMarketToken[];
  name?: string;
  symbol?: string;
}) {
  const normalizedName = normalizeIdentity(name);
  const normalizedSymbol = normalizeIdentity(symbol);

  return (
    candidates.find(
      (candidate) =>
        normalizeIdentity(candidate.symbol) === normalizedSymbol &&
        normalizeIdentity(candidate.name) === normalizedName,
    ) ??
    candidates.find(
      (candidate) => normalizeIdentity(candidate.symbol) === normalizedSymbol,
    )
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
  const name = tokenDetail?.name;

  const { result: legacyDetail, isLoading: isLegacyDetailLoading } =
    usePromiseResult<IMarketTokenDetail | undefined>(
      async () => {
        if (marketTokenId) {
          return backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
            marketTokenId,
          );
        }
        if (!symbol) {
          return undefined;
        }
        const candidates =
          await backgroundApiProxy.serviceMarket.searchToken(symbol);
        const candidate = findTopCoinsMarketTokenCandidate({
          candidates,
          name,
          symbol,
        });
        if (!candidate) {
          return undefined;
        }
        return backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
          candidate.coingeckoId,
        );
      },
      [marketTokenId, name, symbol],
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

  const earnAsset = useMemo(
    () => findTopCoinsEarnAsset({ assets: earnAssets, symbol }),
    [earnAssets, symbol],
  );

  return {
    earnAsset,
    isLegacyDetailLoading,
    legacyDetail,
  };
}
