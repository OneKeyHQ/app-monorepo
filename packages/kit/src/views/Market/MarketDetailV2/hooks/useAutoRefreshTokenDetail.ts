import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useTokenDetailActions,
  useTokenDetailIdentityAtom,
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
  // Computed atom: only re-renders when the detail identity changes, not on
  // every price tick.
  const [storeTokenDetailIdentity] = useTokenDetailIdentityAtom();
  const isMarketAssetRequest = Boolean(
    data.marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID &&
    data.marketTokenId,
  );
  // Asset entries navigate before the variant is known, so the route has no
  // chain identity until the detail request resolves one.
  const isAssetOnlyRequest = Boolean(
    isMarketAssetRequest && !data.networkId && !data.tokenAddress,
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
  // The request key identifies the asset, not the display settings: currency and
  // locale are dependencies that refresh data without invalidating the resolved
  // asset identity of the current route.
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
  const resolvedVariantRef = useRef<
    | {
        requestKey: string;
        variantId: string;
      }
    | undefined
  >(undefined);
  const [assetErrorRequestKey, setAssetErrorRequestKey] = useState<string>();
  // A successful overview can keep the page readable while a later poll fails,
  // but it cannot restore the token detail that an asset switch already cleared.
  const cachedMarketAssetDetail =
    successfulMarketAssetDetailRef.current?.requestKey === tokenDetailRequestKey
      ? successfulMarketAssetDetailRef.current.assetDetail
      : undefined;
  const cachedMarketAssetVariant = cachedMarketAssetDetail?.selectedVariant;
  const storeHandlesCachedDetail = Boolean(
    cachedMarketAssetVariant &&
    storeTokenDetailIdentity ===
      `${cachedMarketAssetVariant.networkId}|${cachedMarketAssetVariant.tokenAddress.toLowerCase()}`,
  );
  const storeHandlesCachedDetailRef = useRef(storeHandlesCachedDetail);
  storeHandlesCachedDetailRef.current = storeHandlesCachedDetail;

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
    const isTokenIdentityChanged =
      prevToken &&
      (prevToken.tokenAddress !== data.tokenAddress ||
        prevToken.networkId !== data.networkId ||
        prevToken.marketTokenId !== data.marketTokenId ||
        prevToken.marketVariantId !== data.marketVariantId);
    // A display-currency change only refreshes prices. Asset-only overview data
    // is requested in USD and identifies the same variant, so keep the resolved
    // detail instead of dropping the route identity (a failed refresh must not
    // collapse the page into its error state).
    const isCurrencyChangedWithoutAssetIdentity =
      prevToken &&
      !isAssetOnlyRequest &&
      prevToken.currencyId !== currencyInfo.id;
    if (isTokenIdentityChanged || isCurrencyChangedWithoutAssetIdentity) {
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
    isAssetOnlyRequest,
    tokenDetailActions,
  ]);

  // Set tokenAddress/networkId/isNative synchronously on prop change,
  // not inside the request callback. This prevents stale responses
  // from writing old token identifiers back into atoms after a token switch.
  useLayoutEffect(() => {
    if (!active) return;
    // The resolved asset identity already owns the atoms; resetting them to the
    // empty route identity would drop the detail while the route is reused.
    if (
      isAssetOnlyRequest &&
      successfulMarketAssetDetailRef.current?.requestKey ===
        tokenDetailRequestKey
    ) {
      return;
    }
    tokenDetailActions.setTokenAddress(data.tokenAddress);
    tokenDetailActions.setNetworkId(data.networkId);
    tokenDetailActions.setIsNative(data.isNative);
  }, [
    active,
    data.tokenAddress,
    data.networkId,
    data.isNative,
    isAssetOnlyRequest,
    tokenDetailRequestKey,
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
      (isAssetOnlyRequest ||
        (data.networkId && (data.tokenAddress || data.isNative))),
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
    isAssetOnlyRequest,
    tokenDetailActions,
  ]);

  const { result, run } = usePromiseResult<
    { requestKey: string; assetDetail: IMarketAssetDetailData } | undefined
  >(
    async () => {
      if (
        !active ||
        data.skipMarketDataFetch ||
        !currencyInfo.id ||
        (!isAssetOnlyRequest &&
          (!data.networkId || (!data.tokenAddress && !data.isNative)))
      ) {
        return;
      }
      try {
        if (isMarketAssetRequest && data.marketTokenId) {
          try {
            const assetDetail = await fetchMarketAssetTokenDetail({
              assetId: data.marketTokenId,
              variantId:
                data.marketVariantId ??
                (resolvedVariantRef.current?.requestKey ===
                tokenDetailRequestKey
                  ? resolvedVariantRef.current.variantId
                  : undefined),
              tokenAddress: data.tokenAddress,
              networkId: data.networkId,
              isCurrentRequest: () =>
                requestScopeRef.current.generation === requestGeneration &&
                currentTokenDetailRequestKeyRef.current ===
                  tokenDetailRequestKey,
            });
            if (
              requestScopeRef.current.generation !== requestGeneration ||
              currentTokenDetailRequestKeyRef.current !== tokenDetailRequestKey
            ) {
              return;
            }
            const requestResult = {
              requestKey: tokenDetailRequestKey,
              assetDetail,
            };
            if (assetDetail.selectedVariant?.variantId) {
              resolvedVariantRef.current = {
                requestKey: tokenDetailRequestKey,
                variantId: assetDetail.selectedVariant.variantId,
              };
            }
            setAssetErrorRequestKey(undefined);
            successfulMarketAssetDetailRef.current = requestResult;
            return requestResult;
          } catch (_error) {
            if (
              requestScopeRef.current.generation !== requestGeneration ||
              currentTokenDetailRequestKeyRef.current !== tokenDetailRequestKey
            ) {
              return;
            }
            const hasCachedDetail =
              successfulMarketAssetDetailRef.current?.requestKey ===
              tokenDetailRequestKey;
            // Suppress the failure only while the shared store can still render
            // this asset; otherwise the page would silently lose its detail.
            const canSuppressError =
              hasCachedDetail &&
              (!isAssetOnlyRequest || storeHandlesCachedDetailRef.current);
            if (!canSuppressError) {
              setAssetErrorRequestKey(tokenDetailRequestKey);
            }
            return canSuppressError
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
      isAssetOnlyRequest,
      tokenDetailActions,
      tokenDetailRequestKey,
      tokenDetailSwrKey,
      requestGeneration,
    ],
    {
      undefinedResultIfError: true,
      // Refresh statistics and recover quotes when the chart feed becomes stale.
      // A stable interval also lets retained routes refetch immediately on entry.
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

  // Localized asset fields (description, about) come back with the response, so
  // a locale change has to request the asset overview again. The token-detail
  // path already re-runs through its locale-scoped SWR key.
  const previousLocaleRef = useRef(locale);
  useEffect(() => {
    if (previousLocaleRef.current === locale) return;
    previousLocaleRef.current = locale;
    if (isMarketAssetRequest) {
      void run();
    }
  }, [isMarketAssetRequest, locale, run]);

  const hasAssetError =
    isAssetOnlyRequest && assetErrorRequestKey === tokenDetailRequestKey;
  let marketAssetDetail: IMarketAssetDetailData | undefined;
  if (!data.skipMarketDataFetch && !hasAssetError) {
    if (result?.requestKey === tokenDetailRequestKey) {
      marketAssetDetail = result.assetDetail;
    } else if (
      successfulMarketAssetDetailRef.current?.requestKey ===
      tokenDetailRequestKey
    ) {
      marketAssetDetail = successfulMarketAssetDetailRef.current.assetDetail;
    }
  }
  const resolvedVariant = isAssetOnlyRequest
    ? marketAssetDetail?.selectedVariant
    : undefined;
  const resolvedMarketAssetIdentity =
    resolvedVariant && data.marketTokenId
      ? {
          isNative: resolvedVariant.isNative,
          marketTokenId: data.marketTokenId,
          marketVariantId: resolvedVariant.variantId,
          networkId: resolvedVariant.networkId,
          tokenAddress: resolvedVariant.tokenAddress,
        }
      : undefined;
  // Another detail page may have taken over the shared atoms while this route
  // was hidden; restoring the address/network is not enough because the cleared
  // token detail may still be empty, so check the detail identity as well.
  let expectedDetailIdentity: string | undefined =
    `${data.networkId}|${data.tokenAddress.toLowerCase()}`;
  if (isAssetOnlyRequest) {
    expectedDetailIdentity = resolvedMarketAssetIdentity
      ? `${resolvedMarketAssetIdentity.networkId}|${resolvedMarketAssetIdentity.tokenAddress.toLowerCase()}`
      : undefined;
  }
  const storeHasDetailForRoute = Boolean(
    expectedDetailIdentity &&
    storeTokenDetailIdentity === expectedDetailIdentity,
  );

  return {
    marketAssetDetail,
    resolvedMarketAssetIdentity,
    hasAssetError,
    retryAssetDetail: () => {
      setAssetErrorRequestKey(undefined);
      void run();
    },
    isInitialTokenDetailPending: Boolean(
      active &&
      !data.skipMarketDataFetch &&
      (isAssetOnlyRequest ||
        (data.networkId && (data.tokenAddress || data.isNative))) &&
      // Re-entering the same route (tab switch, modal close) is not a first
      // load while the store still renders its detail; a cleared/overwritten
      // detail or a new request scope still waits for the fresh response.
      settledRequestGeneration !== requestGeneration &&
      !storeHasDetailForRoute,
    ),
    isMarketAssetDetailLoading:
      data.marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID &&
      isTokenDetailLoading,
  };
}
