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
  enabled?: boolean;
}

function toFiniteNumber(value?: string | number) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function useAutoRefreshTokenDetail(data: IUseMarketDetailDataProps) {
  const enabled = data.enabled ?? true;
  const { current: tokenDetailActions } = useTokenDetailActions();
  const currencyInfo = useCurrency();
  const {
    tokenDetail,
    tokenAddress: activeTokenAddress,
    networkId: activeNetworkId,
    isNative: activeIsNative,
  } = useTokenDetail();
  const [, setCurrentTokenLiveData] = useMarketCurrentTokenLiveDataAtom();
  // External atom updates must not retrigger this route's ownership effect.
  const activeIdentityRef = useRef({
    tokenAddress: activeTokenAddress,
    networkId: activeNetworkId,
    isNative: activeIsNative,
  });
  activeIdentityRef.current = {
    tokenAddress: activeTokenAddress,
    networkId: activeNetworkId,
    isNative: activeIsNative,
  };

  // Sync tokenDetail to global atom so mobile modal can read it
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (
      activeTokenAddress !== data.tokenAddress ||
      activeNetworkId !== data.networkId ||
      !tokenDetail ||
      tokenDetail.address === undefined
    ) {
      setCurrentTokenLiveData(undefined);
      return;
    }
    const buy = toFiniteNumber(tokenDetail.buy24hCount);
    const sell = toFiniteNumber(tokenDetail.sell24hCount);
    setCurrentTokenLiveData({
      networkId: activeNetworkId,
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
  }, [
    activeNetworkId,
    activeTokenAddress,
    data.networkId,
    data.tokenAddress,
    enabled,
    setCurrentTokenLiveData,
    tokenDetail,
  ]);

  // Clear live data when the focused route relinquishes ownership.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return () => {
      setCurrentTokenLiveData(undefined);
    };
  }, [enabled, setCurrentTokenLiveData]);

  const ownedPriceScopeRef = useRef<
    | {
        tokenAddress: string;
        networkId: string;
        currencyId: string;
      }
    | undefined
  >(undefined);

  // Restore the focused route's identity before its request effect starts.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const previousScope = ownedPriceScopeRef.current;
    const isRoutePriceScopeChanged = Boolean(
      previousScope &&
      (previousScope.tokenAddress !== data.tokenAddress ||
        previousScope.networkId !== data.networkId ||
        previousScope.currencyId !== currencyInfo.id),
    );
    const activeIdentity = activeIdentityRef.current;
    const hasActiveIdentity = Boolean(
      activeIdentity.tokenAddress || activeIdentity.networkId,
    );
    const isActiveIdentityChanged =
      hasActiveIdentity &&
      (activeIdentity.tokenAddress !== data.tokenAddress ||
        activeIdentity.networkId !== data.networkId ||
        activeIdentity.isNative !== data.isNative);

    if (isRoutePriceScopeChanged || isActiveIdentityChanged) {
      tokenDetailActions.setTokenDetail(undefined);
      tokenDetailActions.setTokenDetailPreview(undefined);
      tokenDetailActions.setTokenDetailWebsocket(undefined);
      tokenDetailActions.setPerpsInfo(undefined);
    }

    tokenDetailActions.setTokenAddress(data.tokenAddress);
    tokenDetailActions.setNetworkId(data.networkId);
    tokenDetailActions.setTokenDetailCurrencyId(currencyInfo.id);
    tokenDetailActions.setIsNative(data.isNative);
    ownedPriceScopeRef.current = {
      tokenAddress: data.tokenAddress,
      networkId: data.networkId,
      currencyId: currencyInfo.id,
    };
  }, [
    currencyInfo.id,
    data.isNative,
    data.networkId,
    data.tokenAddress,
    enabled,
    tokenDetailActions,
  ]);

  return usePromiseResult(
    async () => {
      if (!enabled || !currencyInfo.id) {
        return;
      }
      // Only fetch token detail data; atom identity is set synchronously above
      await tokenDetailActions.fetchTokenDetail(
        data.tokenAddress,
        data.networkId,
        currencyInfo.id,
      );
    },
    [
      currencyInfo.id,
      enabled,
      data.tokenAddress,
      data.networkId,
      tokenDetailActions,
    ],
    {
      pollingInterval: enabled ? 6000 : undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // The caller owns focus gating through `enabled` so placeholder screens
      // do not start either an initial request or a polling loop.
      checkIsFocused: false,
    },
  );
}
