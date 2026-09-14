import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IMarketTokenDetailRouteParams } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IMarketDetailPlatformNetwork,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';
import { getNetworkIdBySymbol } from '@onekeyhq/shared/types/market/marketProvider.constants';

export function getLegacyMarketPrimaryNetwork(
  token: IMarketTokenDetail | null | undefined,
): IMarketDetailPlatformNetwork | undefined {
  const { detailPlatforms, platforms = {} } = token ?? {};
  if (!detailPlatforms) {
    return undefined;
  }

  const platformList = Object.values(detailPlatforms);
  const nativePlatform = platformList.find((item) => item.isNative);
  if (nativePlatform) {
    return nativePlatform;
  }

  const primaryTokenAddress = Object.values(platforms)[0];
  return (
    platformList.find((item) => item.tokenAddress === primaryTokenAddress) ??
    platformList[0]
  );
}

export function getLegacyMarketNavigationTarget(token: IMarketTokenDetail):
  | {
      decimals?: number;
      isNative: boolean;
      networkId: string;
      skipMarketDataFetch?: boolean;
      tokenAddress: string;
    }
  | undefined {
  const network = getLegacyMarketPrimaryNetwork(token);
  let networkId =
    network?.onekeyNetworkId ?? getNetworkIdBySymbol(token.symbol);
  const primaryPlatform = Object.keys(token.platforms ?? {})[0];
  const isHyperliquidNativeToken =
    !networkId && primaryPlatform === 'hyperliquid';
  if (isHyperliquidNativeToken) {
    networkId = getNetworkIdsMap().hyperevm;
  }
  if (!networkId) {
    return undefined;
  }

  const tokenAddress = network?.tokenAddress ?? '';
  return {
    ...(isHyperliquidNativeToken
      ? { decimals: 18, skipMarketDataFetch: true }
      : undefined),
    isNative:
      isHyperliquidNativeToken ||
      (network?.isNative ?? tokenAddress.length === 0),
    networkId,
    tokenAddress: isHyperliquidNativeToken ? '' : tokenAddress,
  };
}

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function getLegacyMarketDetailV2RouteParams({
  marketTokenId,
  token,
}: {
  marketTokenId: string;
  token: IMarketTokenDetail;
}): IMarketTokenDetailRouteParams {
  const target = getLegacyMarketNavigationTarget(token);
  const usesSyntheticIdentity = !target;
  const network = target?.networkId ?? 'coingecko';
  const tokenAddress = target?.tokenAddress ?? marketTokenId;
  const isNative = target?.isNative ?? false;
  const decimals =
    target?.decimals ??
    (isNative ? networkUtils.getLocalNetworkInfo(network)?.decimals : 0) ??
    0;

  return {
    disableTrade: usesSyntheticIdentity,
    isNative,
    legacyTokenPreview: {
      address: tokenAddress,
      networkId: network,
      isNative,
      name: token.name,
      symbol: token.symbol.toUpperCase(),
      decimals,
      price: toFiniteNumber(token.stats.currentPrice),
      change24h: toFiniteNumber(
        token.stats.performance.priceChangePercentage24h,
      ),
      marketCap: toFiniteNumber(token.stats.marketCap),
      turnover: toFiniteNumber(token.stats.volume24h),
      tokenImageUri: token.image,
      selectedAt: Date.now(),
    },
    marketTokenId,
    network,
    showFavoriteButton: !usesSyntheticIdentity,
    skipMarketDataFetch: target?.skipMarketDataFetch ?? usesSyntheticIdentity,
    tokenAddress,
  };
}
