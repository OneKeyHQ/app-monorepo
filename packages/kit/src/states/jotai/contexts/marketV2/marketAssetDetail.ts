import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IJotaiGetter,
  IJotaiSetter,
} from '@onekeyhq/kit-bg/src/states/jotai/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
      networkId,
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

interface IMarketAssetTokenDetailPayload {
  assetId: string;
  variantId?: string;
  tokenAddress: string;
  networkId: string;
}

async function fetchMarketAssetTokenDetail(
  get: IJotaiGetter,
  set: IJotaiSetter,
  payload: IMarketAssetTokenDetailPayload,
): Promise<IMarketAssetDetailData> {
  const { assetId, variantId, tokenAddress, networkId } = payload;
  let isStale = false;
  const isCurrentIdentity = () =>
    get(tokenAddressAtom()) === tokenAddress &&
    get(networkIdAtom()) === networkId;

  try {
    set(tokenDetailLoadingAtom(), true);

    const assetDetail =
      await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
        assetId,
        variantId,
        currency: MARKET_ASSET_DETAIL_CURRENCY,
      });

    if (!isCurrentIdentity()) {
      isStale = true;
      return assetDetail;
    }

    const { selectedVariant } = assetDetail;
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
      !selectedVariantMatchesRoute ||
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
        tokenAddress,
        networkId,
      }) && currentTokenDetail?.decimalsResolved !== false
        ? currentTokenDetail?.decimals
        : undefined;
    const previewMatchesRoute = tokenDetailPreview
      ? equalTokenNoCaseSensitive({
          token1: {
            networkId,
            contractAddress: tokenAddress,
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

    if (!isValidTokenDecimals(decimals)) {
      try {
        const tokenInfo =
          await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
            networkId: selectedVariant.networkId,
            tokenAddress: selectedVariant.tokenAddress,
          });
        decimals = tokenInfo?.info?.decimals;
      } catch {
        decimals = undefined;
      }
    }

    if (!isCurrentIdentity()) {
      isStale = true;
      return assetDetail;
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
        tokenAddress,
        networkId,
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

    set(tokenDetailAtom(), finalTokenData);
    set(tokenDetailPreviewAtom(), undefined);
    set(tokenDetailWebsocketAtom(), undefined);
    set(perpsInfoAtom(), undefined);
    set(isNativeAtom(), selectedVariant.isNative);

    return assetDetail;
  } catch (error) {
    defaultLogger.app.error.log(
      `Failed to fetch market asset detail: ${String(error)}`,
    );
    if (isCurrentIdentity()) {
      set(tokenDetailAtom(), undefined);
      set(tokenDetailPreviewAtom(), undefined);
      set(tokenDetailWebsocketAtom(), undefined);
      set(perpsInfoAtom(), undefined);
    } else {
      isStale = true;
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
