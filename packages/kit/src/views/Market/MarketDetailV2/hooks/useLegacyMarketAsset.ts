import { useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { useNetInfo } from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { findLegacyMarketWatchlistItem } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { resolveSwapMarketAsset } from '../../utils/resolveSwapMarketAsset';
import { resolveMarketTopCoinNavigationTarget } from '../utils/resolveMarketTopCoinNavigationTarget';

type IAssetParams = NonNullable<
  Awaited<ReturnType<typeof resolveSwapMarketAsset>>
>;

export function useLegacyMarketAsset({
  active,
  networkId,
  tokenAddress,
  isNative,
  marketTokenId,
  marketTokenCategory,
  isStockRoute,
  symbol,
}: {
  active: boolean;
  networkId: string;
  tokenAddress: string;
  isNative: boolean;
  marketTokenId?: string;
  marketTokenCategory?: string;
  isStockRoute: boolean;
  symbol?: string;
}) {
  const isFocused = useIsFocused();
  const [watchlist] = useMarketWatchListV2Atom();
  const identity = useMemo(
    () => ({ networkId, tokenAddress, isNative, marketTokenId }),
    [networkId, tokenAddress, isNative, marketTokenId],
  );
  const [resolved, setResolved] = useState<{
    identity: typeof identity;
    params: IAssetParams | undefined;
  }>();
  const network = networkUtils.getLocalNetworkInfo(networkId);
  const isLegacyFavorite = Boolean(
    findLegacyMarketWatchlistItem(watchlist.data, identity),
  );
  // Native detail loading releases its preview before asset resolution completes.
  const retainedSymbol = useRef<{ identity: typeof identity; symbol?: string }>(
    undefined,
  );
  if (retainedSymbol.current?.identity !== identity) {
    retainedSymbol.current = { identity, symbol };
  } else if (symbol) {
    retainedSymbol.current.symbol = symbol;
  }
  const tokenSymbol = isNative
    ? (network?.symbol ?? '')
    : (retainedSymbol.current.symbol ?? '');
  const shouldResolve = Boolean(
    !isStockRoute &&
    !marketTokenCategory &&
    network &&
    !network.isTestnet &&
    (isNative || isLegacyFavorite),
  );
  const assetParams =
    !isStockRoute && !marketTokenCategory && resolved?.identity === identity
      ? resolved.params
      : undefined;
  const { isRawInternetReachable } = useNetInfo(shouldResolve && !assetParams);
  const isOnline = isRawInternetReachable !== false;

  useEffect(() => {
    if (!active || !isFocused || !isOnline || !shouldResolve || assetParams)
      return;
    const controller = new AbortController();
    const resolve = async (): Promise<IAssetParams | undefined> => {
      if (identity.marketTokenId) {
        const target = await resolveMarketTopCoinNavigationTarget({
          assetId: identity.marketTokenId,
          preferredToken: identity,
        });
        return target
          ? {
              network: target.networkId,
              tokenAddress: target.tokenAddress,
              isNative: target.isNative,
              marketTokenId: target.marketTokenId,
              marketVariantId: target.marketVariantId,
              marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
            }
          : undefined;
      }
      return resolveSwapMarketAsset(
        { ...identity, symbol: tokenSymbol },
        controller.signal,
        { searchAndSymbolOnly: true },
      );
    };
    void resolve()
      .catch(() => undefined)
      .then((params) => {
        if (controller.signal.aborted) return;
        setResolved({ identity, params });
      });
    return () => controller.abort();
  }, [
    active,
    isFocused,
    isOnline,
    shouldResolve,
    assetParams,
    identity,
    tokenSymbol,
  ]);

  return {
    assetParams,
    isResolving: Boolean(
      active &&
      isFocused &&
      isOnline &&
      shouldResolve &&
      resolved?.identity !== identity,
    ),
  };
}
