import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IJotaiGetter,
  IJotaiSetter,
} from '@onekeyhq/kit-bg/src/states/jotai/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import {
  contextAtomMethod,
  isNativeAtom,
  networkIdAtom,
  perpsInfoAtom,
  tokenAddressAtom,
  tokenDetailAtom,
  tokenDetailLoadingAtom,
  tokenDetailPreviewAtom,
  tokenDetailRequestIdAtom,
  tokenDetailWebsocketAtom,
} from './atoms';

const CHART_PRICE_FRESHNESS_MS = 10_000;
const MARKET_ASSET_DETAIL_CURRENCY = 'usd';
const MARKET_CHART_FALLBACK_DECIMALS = 2;

function isSameMarketTokenDetail({
  tokenDetail,
  tokenAddress,
  networkId,
}: {
  tokenDetail?: IMarketTokenDetail;
  tokenAddress: string;
  networkId: string;
}) {
  if (!tokenDetail) {
    return false;
  }

  return equalTokenNoCaseSensitive({
    token1: {
      networkId,
      contractAddress: tokenAddress,
    },
    token2: {
      networkId: tokenDetail.networkId || '',
      contractAddress: tokenDetail.address || '',
    },
  });
}

function isValidTokenDecimals(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function buildMarketAssetTokenDetail({
  assetDetail,
  decimals,
  lastUpdated,
}: {
  assetDetail: IMarketAssetDetailData;
  decimals?: number;
  lastUpdated: number;
}): IMarketTokenDetail {
  const { asset, market, performance, selectedVariant } = assetDetail;

  return {
    address: selectedVariant.tokenAddress,
    networkId: selectedVariant.networkId,
    isNative: selectedVariant.isNative,
    logoUrl: asset.logoUrl,
    name: asset.name,
    symbol: asset.symbol.toUpperCase(),
    decimals: decimals ?? MARKET_CHART_FALLBACK_DECIMALS,
    decimalsResolved: decimals !== undefined,
    price: market.price,
    priceChange24hPercent: market.priceChange24hPercent,
    priceChange7dPercent: performance.priceChange7dPercent,
    priceChange30dPercent: performance.priceChange30dPercent,
    priceChange3mPercent: performance.priceChange3mPercent,
    priceChange1yPercent: performance.priceChange1yPercent,
    marketCap: market.marketCap,
    fdv: market.fdv,
    circulatingSupply: market.circulatingSupply,
    volume24h: market.volume24h,
    lastUpdated,
  };
}

// The asset detail response has no perps field, so the Hyperliquid counterpart
// is resolved separately. Kept off the detail render path: the banner appearing
// a beat late is better than delaying price and chart data behind it.
async function applyMarketAssetPerpsInfo({
  set,
  symbol,
  isCurrentIdentity,
}: {
  set: IJotaiSetter;
  symbol: string;
  isCurrentIdentity: () => boolean;
}) {
  try {
    const perpsInfo =
      await backgroundApiProxy.serviceHyperliquid.resolveMarketPerpsInfoBySymbol(
        { symbol },
      );
    // Only write a hit. A miss must not clear the atom: changeActiveToken may
    // have supplied API-derived perps info for this same token, and switching
    // tokens already clears it.
    if (perpsInfo && isCurrentIdentity()) {
      set(perpsInfoAtom(), perpsInfo);
    }
  } catch (error) {
    defaultLogger.app.error.log(
      `Failed to resolve market perps info: ${String(error)}`,
    );
  }
}

interface IMarketAssetTokenDetailPayload {
  assetId: string;
  variantId?: string;
  tokenAddress: string;
  networkId: string;
  reuseInitialResult?: boolean;
  isCurrentRequest?: () => boolean;
}

async function fetchMarketAssetTokenDetail(
  get: IJotaiGetter,
  set: IJotaiSetter,
  payload: IMarketAssetTokenDetailPayload,
): Promise<IMarketAssetDetailData> {
  const {
    assetId,
    variantId,
    tokenAddress,
    networkId,
    reuseInitialResult,
    isCurrentRequest,
  } = payload;
  const isAssetOnly = !tokenAddress && !networkId;
  const expectedTokenAddress = isAssetOnly
    ? get(tokenAddressAtom())
    : tokenAddress;
  const expectedNetworkId = isAssetOnly ? get(networkIdAtom()) : networkId;
  const requestId = get(tokenDetailRequestIdAtom()) + 1;
  set(tokenDetailRequestIdAtom(), requestId);
  let isStale = false;
  let resolvedIdentity: { tokenAddress: string; networkId: string } | undefined;
  const isCurrentIdentity = () =>
    get(tokenDetailRequestIdAtom()) === requestId &&
    (isCurrentRequest?.() ?? true) &&
    get(tokenAddressAtom()) ===
      (resolvedIdentity?.tokenAddress ?? expectedTokenAddress) &&
    get(networkIdAtom()) === (resolvedIdentity?.networkId ?? expectedNetworkId);

  try {
    set(tokenDetailLoadingAtom(), true);

    const assetDetail =
      await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
        assetId,
        variantId,
        currency: MARKET_ASSET_DETAIL_CURRENCY,
        ...(reuseInitialResult ? { reuseInitialResult: true } : undefined),
      });

    if (!isCurrentIdentity()) {
      isStale = true;
      throw new OneKeyLocalError('Stale market asset detail request');
    }

    const { selectedVariant } = assetDetail;
    const detailTokenAddress = isAssetOnly
      ? selectedVariant.tokenAddress
      : tokenAddress;
    const detailNetworkId = isAssetOnly ? selectedVariant.networkId : networkId;
    const selectedVariantMatchesRoute = equalTokenNoCaseSensitive({
      token1: {
        networkId,
        contractAddress: tokenAddress,
      },
      token2: {
        networkId: selectedVariant.networkId,
        contractAddress: selectedVariant.tokenAddress,
      },
    });
    if (
      assetDetail.asset.assetId !== assetId ||
      (!isAssetOnly && !selectedVariantMatchesRoute) ||
      !networkUtils.getLocalNetworkInfo(selectedVariant.networkId) ||
      (!selectedVariant.isNative && !selectedVariant.tokenAddress) ||
      (variantId && selectedVariant.variantId !== variantId)
    ) {
      throw new OneKeyLocalError(
        'Market asset detail variant does not match the active route',
      );
    }

    const currentTokenDetail = get(tokenDetailAtom());
    const tokenDetailPreview = get(tokenDetailPreviewAtom());
    const currentDecimals =
      isSameMarketTokenDetail({
        tokenDetail: currentTokenDetail,
        tokenAddress: detailTokenAddress,
        networkId: detailNetworkId,
      }) && currentTokenDetail?.decimalsResolved !== false
        ? currentTokenDetail?.decimals
        : undefined;
    const previewMatchesRoute = tokenDetailPreview
      ? equalTokenNoCaseSensitive({
          token1: {
            networkId: detailNetworkId,
            contractAddress: detailTokenAddress,
          },
          token2: {
            networkId: tokenDetailPreview.networkId,
            contractAddress: tokenDetailPreview.address,
          },
        })
      : false;
    let decimals = previewMatchesRoute
      ? tokenDetailPreview?.decimals
      : currentDecimals;

    if (!isValidTokenDecimals(decimals) && selectedVariant.isNative) {
      decimals = networkUtils.getLocalNetworkInfo(
        selectedVariant.networkId,
      )?.decimals;
    }

    if (!isCurrentIdentity()) {
      isStale = true;
      throw new OneKeyLocalError('Stale market asset detail request');
    }

    const lastUpdated = Date.now();
    const tokenData = buildMarketAssetTokenDetail({
      assetDetail,
      decimals: isValidTokenDecimals(decimals) ? decimals : undefined,
      lastUpdated,
    });
    const chartPriceUpdatedAt = currentTokenDetail?.chartPriceUpdatedAt;
    const hasFreshKLinePrice =
      isSameMarketTokenDetail({
        tokenDetail: currentTokenDetail,
        tokenAddress: detailTokenAddress,
        networkId: detailNetworkId,
      }) &&
      typeof chartPriceUpdatedAt === 'number' &&
      Number.isFinite(chartPriceUpdatedAt) &&
      lastUpdated - chartPriceUpdatedAt < CHART_PRICE_FRESHNESS_MS;
    const finalTokenData = hasFreshKLinePrice
      ? {
          ...tokenData,
          price: currentTokenDetail?.price,
          lastUpdated: currentTokenDetail?.lastUpdated,
          chartPriceUpdatedAt,
        }
      : tokenData;

    if (isAssetOnly) {
      resolvedIdentity = {
        tokenAddress: selectedVariant.tokenAddress,
        networkId: selectedVariant.networkId,
      };
      set(tokenAddressAtom(), selectedVariant.tokenAddress);
      set(networkIdAtom(), selectedVariant.networkId);
    }
    set(tokenDetailAtom(), finalTokenData);
    set(tokenDetailPreviewAtom(), undefined);
    set(tokenDetailWebsocketAtom(), undefined);
    set(isNativeAtom(), selectedVariant.isNative);
    if (!isValidTokenDecimals(decimals)) {
      void backgroundApiProxy.serviceToken
        .fetchTokenInfoOnly({
          networkId: selectedVariant.networkId,
          tokenAddress: selectedVariant.tokenAddress,
        })
        .then((tokenInfo) => {
          const resolvedDecimals = tokenInfo?.info?.decimals;
          if (!isValidTokenDecimals(resolvedDecimals) || !isCurrentIdentity()) {
            return;
          }
          const latestTokenDetail = get(tokenDetailAtom());
          if (
            latestTokenDetail &&
            isSameMarketTokenDetail({
              tokenDetail: latestTokenDetail,
              tokenAddress: selectedVariant.tokenAddress,
              networkId: selectedVariant.networkId,
            })
          ) {
            set(tokenDetailAtom(), {
              ...latestTokenDetail,
              decimals: resolvedDecimals,
              decimalsResolved: true,
            });
          }
        })
        .catch(() => undefined);
    }
    void applyMarketAssetPerpsInfo({
      set,
      symbol: finalTokenData.symbol,
      isCurrentIdentity,
    });

    return assetDetail;
  } catch (error) {
    if (!isCurrentIdentity()) {
      isStale = true;
    }
    if (!isStale) {
      defaultLogger.app.error.log(
        `Failed to fetch market asset detail: ${String(error)}`,
      );
    }
    throw error;
  } finally {
    if (!isStale) {
      set(tokenDetailLoadingAtom(), false);
    }
  }
}

const fetchMarketAssetTokenDetailAction = contextAtomMethod(
  fetchMarketAssetTokenDetail,
);

export function useMarketAssetTokenDetailAction() {
  return fetchMarketAssetTokenDetailAction.use();
}
