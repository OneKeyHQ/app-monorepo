import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useTokenDetailActions,
  useTokenDetailLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketAssetTokenDetailAction } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketAssetDetail';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import {
  type IMarketAssetRouteIdentity,
  resolveMarketAssetRouteIdentity,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveMarketAssetRouteIdentity';
import { useMarketCurrentTokenLiveDataAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

interface IUseMarketDetailDataProps {
  active?: boolean;
  resumeOnEffectReconnect?: boolean;
  tokenAddress: string;
  networkId: string;
  isNative: boolean;
  skipMarketDataFetch?: boolean;
  marketTokenId?: string;
  marketVariantId?: string;
  marketTokenCategory?: string;
}

interface IUseResolvedMarketAssetRouteIdentityProps {
  enabled: boolean;
  active?: boolean;
  tokenAddress: string;
  networkId: string;
  symbol?: string;
  isNative: boolean;
}

type IMarketAssetRouteIdentityResult = Omit<
  IUseResolvedMarketAssetRouteIdentityProps,
  'enabled'
> & {
  identity?: IMarketAssetRouteIdentity;
};

function toFiniteNumber(value?: string | number) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function useResolvedMarketAssetRouteIdentity({
  enabled,
  active = true,
  tokenAddress,
  networkId,
  symbol,
  isNative,
}: IUseResolvedMarketAssetRouteIdentityProps) {
  const [result, setResult] = useState<IMarketAssetRouteIdentityResult>();
  const isCurrentResult = Boolean(
    result &&
    result.tokenAddress === tokenAddress &&
    result.networkId === networkId &&
    result.symbol === symbol &&
    result.isNative === isNative,
  );

  const hasResolvedIdentity = isCurrentResult && Boolean(result?.identity);

  useEffect(() => {
    // Keep the canonical identity for this route across focus changes.
    if (!enabled || !active || !symbol || hasResolvedIdentity) {
      return;
    }

    let isActive = true;
    void resolveMarketAssetRouteIdentity({
      tokenAddress,
      networkId,
      symbol,
      isNative,
    }).then((identity) => {
      if (isActive) {
        setResult({ tokenAddress, networkId, symbol, isNative, identity });
      }
    });

    return () => {
      isActive = false;
    };
  }, [
    active,
    enabled,
    hasResolvedIdentity,
    isNative,
    networkId,
    symbol,
    tokenAddress,
  ]);

  return {
    identity: enabled && isCurrentResult ? result?.identity : undefined,
    isResolving: Boolean(enabled && active && symbol && !isCurrentResult),
    shouldSkipMarketDataFetch: Boolean(enabled && symbol && !isCurrentResult),
  };
}

// Keep live quote mirroring in a leaf so price ticks do not render the page.
export function useSyncMarketCurrentTokenLiveData() {
  const { tokenDetail, networkId } = useTokenDetail();
  const [, setCurrentTokenLiveData] = useMarketCurrentTokenLiveDataAtom();

  useEffect(() => {
    if (!tokenDetail || tokenDetail.address === undefined || !networkId) {
      setCurrentTokenLiveData(undefined);
      return;
    }
    const buy = toFiniteNumber(tokenDetail.buy24hCount);
    const sell = toFiniteNumber(tokenDetail.sell24hCount);
    setCurrentTokenLiveData({
      networkId,
      address: tokenDetail.address,
      price: toFiniteNumber(tokenDetail.price),
      change24h: toFiniteNumber(tokenDetail.priceChange24hPercent),
      marketCap: toFiniteNumber(tokenDetail.marketCap),
      liquidity: toFiniteNumber(tokenDetail.liquidity),
      transactions: toFiniteNumber(tokenDetail.trade24hCount),
      uniqueTraders: toFiniteNumber(tokenDetail.uniqueWallet24h),
      holders: toFiniteNumber(tokenDetail.holders),
      turnover: toFiniteNumber(tokenDetail.volume24h),
      walletInfo:
        buy !== undefined || sell !== undefined
          ? { buy: buy ?? 0, sell: sell ?? 0 }
          : undefined,
    });
  }, [tokenDetail, networkId, setCurrentTokenLiveData]);

  useEffect(
    () => () => {
      setCurrentTokenLiveData(undefined);
    },
    [setCurrentTokenLiveData],
  );
}

export function useAutoRefreshTokenDetail(data: IUseMarketDetailDataProps) {
  const active = data.active !== false;
  const { current: tokenDetailActions } = useTokenDetailActions();
  const fetchMarketAssetTokenDetail = useMarketAssetTokenDetailAction();
  const currencyInfo = useCurrency();
  const [isTokenDetailLoading] = useTokenDetailLoadingAtom();
  const isMarketAssetRequest = Boolean(
    data.marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID &&
    data.marketTokenId,
  );
  const locale = useLocaleVariant().toLowerCase();
  // The response carries currency-converted and localized fields.
  const tokenDetailSwrKey =
    active &&
    !data.skipMarketDataFetch &&
    !isMarketAssetRequest &&
    currencyInfo.id &&
    data.networkId &&
    (data.tokenAddress || data.isNative)
      ? swrKeys.marketTokenDetail({
          networkId: data.networkId,
          tokenAddress:
            normalizeTokenContractAddress({
              networkId: data.networkId,
              contractAddress: data.tokenAddress,
            }) ?? '',
          currencyId: currencyInfo.id,
          locale,
        })
      : undefined;
  const tokenDetailRequestKey = [
    isMarketAssetRequest ? 'asset' : 'token',
    data.marketTokenId ?? '',
    data.marketVariantId ?? '',
    data.networkId,
    data.tokenAddress,
  ]
    .map(encodeURIComponent)
    .join(':');
  const [settledRequestGeneration, setSettledRequestGeneration] =
    useState<number>();
  const requestScopeRef = useRef({ key: '', generation: 0 });
  const activeRequestKey =
    data.skipMarketDataFetch || !active ? '' : tokenDetailRequestKey;
  if (requestScopeRef.current.key !== activeRequestKey) {
    requestScopeRef.current = {
      key: activeRequestKey,
      generation: requestScopeRef.current.generation + 1,
    };
  }
  const requestGeneration = requestScopeRef.current.generation;
  const currentTokenDetailRequestKeyRef = useRef<string | undefined>(undefined);
  currentTokenDetailRequestKeyRef.current =
    data.skipMarketDataFetch || !active ? undefined : tokenDetailRequestKey;
  const successfulMarketAssetDetailRef = useRef<
    | {
        requestKey: string;
        assetDetail: IMarketAssetDetailData;
      }
    | undefined
  >(undefined);

  // Track previous price scope to avoid showing stale token or currency data.
  const prevTokenRef = useRef<
    | {
        tokenAddress: string;
        networkId: string;
        currencyId: string;
        marketTokenId?: string;
        marketVariantId?: string;
      }
    | undefined
  >(undefined);

  // Clear cached token detail when switching token or display currency.
  // This prevents showing stale data from the previous price scope.
  useLayoutEffect(() => {
    if (!active) return;
    const prevToken = prevTokenRef.current;
    const isTokenChanged =
      prevToken &&
      (prevToken.tokenAddress !== data.tokenAddress ||
        prevToken.networkId !== data.networkId ||
        prevToken.currencyId !== currencyInfo.id ||
        prevToken.marketTokenId !== data.marketTokenId ||
        prevToken.marketVariantId !== data.marketVariantId);
    if (isTokenChanged) {
      // The preview atom remains available for seamless list-to-detail
      // transitions, but a full detail response must never cross identities.
      tokenDetailActions.setTokenDetail(undefined);
      tokenDetailActions.setTokenDetailWebsocket(undefined);
      tokenDetailActions.setPerpsInfo(undefined);
    }

    // Update ref for next comparison
    prevTokenRef.current = {
      tokenAddress: data.tokenAddress,
      networkId: data.networkId,
      currencyId: currencyInfo.id,
      marketTokenId: data.marketTokenId,
      marketVariantId: data.marketVariantId,
    };
  }, [
    active,
    currencyInfo.id,
    data.marketTokenId,
    data.marketVariantId,
    data.tokenAddress,
    data.networkId,
    tokenDetailActions,
  ]);

  // Set tokenAddress/networkId/isNative synchronously on prop change,
  // NOT inside the polling callback. This prevents stale polling responses
  // from writing old token identifiers back into atoms after a token switch.
  useLayoutEffect(() => {
    if (!active) return;
    tokenDetailActions.setTokenAddress(data.tokenAddress);
    tokenDetailActions.setNetworkId(data.networkId);
    tokenDetailActions.setIsNative(data.isNative);
  }, [
    active,
    data.tokenAddress,
    data.networkId,
    data.isNative,
    tokenDetailActions,
  ]);

  // Runs after the identity writes above so the seed matches the new token.
  useLayoutEffect(() => {
    if (!tokenDetailSwrKey) return;
    tokenDetailActions.seedTokenDetailFromCache({
      tokenAddress: data.tokenAddress,
      networkId: data.networkId,
      swrKey: tokenDetailSwrKey,
    });
  }, [
    data.networkId,
    data.tokenAddress,
    tokenDetailActions,
    tokenDetailSwrKey,
  ]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const canFetch = Boolean(
      !data.skipMarketDataFetch &&
      currencyInfo.id &&
      data.networkId &&
      (data.tokenAddress || data.isNative),
    );
    if (!canFetch) {
      tokenDetailActions.setTokenDetailLoading(false);
    }
  }, [
    active,
    currencyInfo.id,
    data.isNative,
    data.networkId,
    data.skipMarketDataFetch,
    data.tokenAddress,
    tokenDetailActions,
  ]);

  const { result } = usePromiseResult<
    { requestKey: string; assetDetail: IMarketAssetDetailData } | undefined
  >(
    async () => {
      if (
        !active ||
        data.skipMarketDataFetch ||
        !currencyInfo.id ||
        !data.networkId ||
        (!data.tokenAddress && !data.isNative)
      ) {
        return;
      }
      try {
        if (isMarketAssetRequest && data.marketTokenId) {
          try {
            const assetDetail = await fetchMarketAssetTokenDetail({
              assetId: data.marketTokenId,
              variantId: data.marketVariantId,
              tokenAddress: data.tokenAddress,
              networkId: data.networkId,
            });
            if (
              currentTokenDetailRequestKeyRef.current !== tokenDetailRequestKey
            ) {
              return;
            }
            const requestResult = {
              requestKey: tokenDetailRequestKey,
              assetDetail,
            };
            successfulMarketAssetDetailRef.current = requestResult;
            return requestResult;
          } catch (_error) {
            if (
              currentTokenDetailRequestKeyRef.current !== tokenDetailRequestKey
            ) {
              return;
            }
            return successfulMarketAssetDetailRef.current?.requestKey ===
              tokenDetailRequestKey
              ? successfulMarketAssetDetailRef.current
              : undefined;
          }
        }
        // Only fetch token detail data; atom identity is set synchronously above
        await tokenDetailActions.fetchTokenDetail(
          data.tokenAddress,
          data.networkId,
          { swrKey: tokenDetailSwrKey },
        );
      } finally {
        if (
          requestScopeRef.current.generation === requestGeneration &&
          currentTokenDetailRequestKeyRef.current === tokenDetailRequestKey
        ) {
          setSettledRequestGeneration(requestGeneration);
        }
      }
    },
    [
      active,
      currencyInfo.id,
      data.isNative,
      data.marketTokenId,
      data.marketVariantId,
      data.tokenAddress,
      data.networkId,
      data.skipMarketDataFetch,
      fetchMarketAssetTokenDetail,
      isMarketAssetRequest,
      tokenDetailActions,
      tokenDetailRequestKey,
      tokenDetailSwrKey,
      requestGeneration,
    ],
    {
      undefinedResultIfError: true,
      // Keep the interval identity stable while a retained Desktop/Web route is
      // inactive. usePromiseResult delays a changed interval by its full
      // duration; a stable interval lets the active dependency refetch
      // immediately when the user returns to the route.
      pollingInterval: 6000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      resumeOnEffectReconnect: data.resumeOnEffectReconnect,
      // Disable focus check to allow data fetching when navigating from Modal to Tab
      // This is needed because when navigating from MarketBannerDetail (Modal) to MarketDetailV2 (Tab),
      // the Modal may still be in the navigation stack, causing isFocused to return false
      checkIsFocused: false,
    },
  );

  const marketAssetDetail =
    !data.skipMarketDataFetch && result?.requestKey === tokenDetailRequestKey
      ? result.assetDetail
      : undefined;

  return {
    marketAssetDetail,
    isInitialTokenDetailPending: Boolean(
      active &&
      !data.skipMarketDataFetch &&
      data.networkId &&
      (data.tokenAddress || data.isNative) &&
      settledRequestGeneration !== requestGeneration,
    ),
    isMarketAssetDetailLoading:
      data.marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID &&
      isTokenDetailLoading,
  };
}
