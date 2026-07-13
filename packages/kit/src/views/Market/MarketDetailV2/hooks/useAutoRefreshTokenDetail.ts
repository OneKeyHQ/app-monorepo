import { useEffect, useRef } from 'react';

import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import { useMarketCurrentTokenLiveDataAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

interface IUseMarketDetailDataProps {
  tokenAddress: string;
  networkId: string;
  isNative: boolean;
}

function toFiniteNumber(value?: string | number) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function useAutoRefreshTokenDetail(data: IUseMarketDetailDataProps) {
  const { current: tokenDetailActions } = useTokenDetailActions();
  const currencyInfo = useCurrency();
  const { tokenDetail, networkId } = useTokenDetail();
  const [, setCurrentTokenLiveData] = useMarketCurrentTokenLiveDataAtom();

  // Sync tokenDetail to global atom so mobile modal can read it
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

  // Clear global atom only on unmount — separate from sync effect to avoid
  // briefly setting undefined on every poll tick (cleanup runs before re-execute).
  useEffect(
    () => () => {
      setCurrentTokenLiveData(undefined);
    },
    [setCurrentTokenLiveData],
  );

  // Track previous price scope to avoid showing stale token or currency data.
  const prevTokenRef = useRef<{
    tokenAddress: string;
    networkId: string;
    currencyId: string;
  }>({
    tokenAddress: '',
    networkId: '',
    currencyId: '',
  });

  // Clear cached token detail when switching token or display currency.
  // This prevents showing stale data from the previous price scope.
  useEffect(() => {
    const prevToken = prevTokenRef.current;
    const isTokenChanged =
      prevToken.tokenAddress !== data.tokenAddress ||
      prevToken.networkId !== data.networkId ||
      prevToken.currencyId !== currencyInfo.id;

    if (isTokenChanged && prevToken.tokenAddress !== '') {
      // Only clear display-related atoms when switching tokens.
      // Do NOT call clearTokenDetail() here — it resets tokenAddressAtom
      // and networkIdAtom to '', which races with changeActiveToken's
      // in-flight fetch and causes its stale check to discard the result.
      tokenDetailActions.setTokenDetail(undefined);
      tokenDetailActions.setTokenDetailWebsocket(undefined);
      tokenDetailActions.setPerpsInfo(undefined);
    }

    // Update ref for next comparison
    prevTokenRef.current = {
      tokenAddress: data.tokenAddress,
      networkId: data.networkId,
      currencyId: currencyInfo.id,
    };
  }, [currencyInfo.id, data.tokenAddress, data.networkId, tokenDetailActions]);

  // Set tokenAddress/networkId/isNative synchronously on prop change,
  // NOT inside the polling callback. This prevents stale polling responses
  // from writing old token identifiers back into atoms after a token switch.
  useEffect(() => {
    tokenDetailActions.setTokenAddress(data.tokenAddress);
    tokenDetailActions.setNetworkId(data.networkId);
    tokenDetailActions.setIsNative(data.isNative);
  }, [data.tokenAddress, data.networkId, data.isNative, tokenDetailActions]);

  return usePromiseResult(
    async () => {
      if (!currencyInfo.id) {
        return;
      }
      // Only fetch token detail data; atom identity is set synchronously above
      await tokenDetailActions.fetchTokenDetail(
        data.tokenAddress,
        data.networkId,
      );
    },
    [currencyInfo.id, data.tokenAddress, data.networkId, tokenDetailActions],
    {
      pollingInterval: 6000, // Changed from 5000 to 6000 to avoid race condition with K-line updates
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Disable focus check to allow data fetching when navigating from Modal to Tab
      // This is needed because when navigating from MarketBannerDetail (Modal) to MarketDetailV2 (Tab),
      // the Modal may still be in the navigation stack, causing isFocused to return false
      checkIsFocused: false,
    },
  );
}
