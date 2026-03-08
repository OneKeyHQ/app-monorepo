import { useEffect, useRef } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

interface IUseMarketDetailDataProps {
  tokenAddress: string;
  networkId: string;
  isNative: boolean;
}

export function useAutoRefreshTokenDetail(data: IUseMarketDetailDataProps) {
  const { current: tokenDetailActions } = useTokenDetailActions();

  // Track previous token to detect when switching to a different token
  const prevTokenRef = useRef<{ tokenAddress: string; networkId: string }>({
    tokenAddress: '',
    networkId: '',
  });

  // Clear cached token detail when switching to a different token
  // This prevents showing stale data from the previous token
  useEffect(() => {
    const prevToken = prevTokenRef.current;
    const isTokenChanged =
      prevToken.tokenAddress !== data.tokenAddress ||
      prevToken.networkId !== data.networkId;

    if (isTokenChanged && prevToken.tokenAddress !== '') {
      // Clear old token data immediately when switching tokens
      tokenDetailActions.clearTokenDetail();
    }

    // Update ref for next comparison
    prevTokenRef.current = {
      tokenAddress: data.tokenAddress,
      networkId: data.networkId,
    };
  }, [data.tokenAddress, data.networkId, tokenDetailActions]);

  return usePromiseResult(
    async () => {
      // Always fetch token detail data to get complete token information
      // The K-line price priority logic is handled inside fetchTokenDetail
      await tokenDetailActions.fetchTokenDetail(
        data.tokenAddress,
        data.networkId,
      );

      // Set the tokenAddress, networkId, and isNative in jotai state
      tokenDetailActions.setTokenAddress(data.tokenAddress);
      tokenDetailActions.setNetworkId(data.networkId);
      tokenDetailActions.setIsNative(data.isNative);
    },
    [data.tokenAddress, data.networkId, data.isNative, tokenDetailActions],
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
