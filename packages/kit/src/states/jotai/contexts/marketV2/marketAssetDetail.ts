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
  marketPerpsResolutionAtom,
  networkIdAtom,
  perpsInfoAtom,
  tokenAddressAtom,
  tokenDetailAtom,
  tokenDetailLoadingAtom,
  tokenDetailPreviewAtom,
  tokenDetailRequestIdAtom,
  tokenDetailWebsocketAtom,
} from './atoms';
import {
  isSameMarketTokenDetail,
  mergeMarketTokenDetailPrice,
} from './marketTokenDetailPrice';

const MARKET_ASSET_DETAIL_CURRENCY = 'usd';
const MARKET_CHART_FALLBACK_DECIMALS = 2;

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

// Resolve support independently of chart readiness. The footer reserves the
// entry until this request settles without blocking the asset detail response.
async function applyMarketAssetPerpsInfo({
  set,
  symbol,
  isCurrentIdentity,
  resolution,
}: {
  set: IJotaiSetter;
  symbol: string;
  isCurrentIdentity: () => boolean;
  resolution: {
    networkId: string;
    tokenAddress: string;
    requestId: number;
  };
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
    if (isCurrentIdentity()) {
      set(marketPerpsResolutionAtom(), {
        ...resolution,
        status: 'resolved',
      });
    }
  } catch (error) {
    if (isCurrentIdentity()) {
      set(marketPerpsResolutionAtom(), {
        ...resolution,
        status: 'error',
      });
    }
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
}

async function fetchMarketAssetTokenDetail(
  get: IJotaiGetter,
  set: IJotaiSetter,
  payload: IMarketAssetTokenDetailPayload,
): Promise<IMarketAssetDetailData> {
  const { assetId, variantId, tokenAddress, networkId } = payload;
  const requestStartedAt = Date.now();
  const requestId = get(tokenDetailRequestIdAtom()) + 1;
  set(tokenDetailRequestIdAtom(), requestId);
  const previousResolution = get(marketPerpsResolutionAtom());
  const resolution = { networkId, tokenAddress, requestId };
  set(marketPerpsResolutionAtom(), {
    ...resolution,
    status:
      previousResolution?.networkId === networkId &&
      previousResolution.tokenAddress === tokenAddress &&
      previousResolution.status === 'resolved'
        ? 'resolved'
        : 'pending',
  });
  let isStale = false;
  const isCurrentIdentity = () =>
    get(tokenDetailRequestIdAtom()) === requestId &&
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
      throw new OneKeyLocalError('Stale market asset detail request');
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

    void applyMarketAssetPerpsInfo({
      set,
      symbol: assetDetail.asset.symbol.toUpperCase(),
      isCurrentIdentity,
      resolution,
    });

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
      if (selectedVariant.isNative) {
        decimals = networkUtils.getLocalNetworkInfo(
          selectedVariant.networkId,
        )?.decimals;
      }
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
    // Chart updates may arrive while the decimals lookup is in flight.
    const finalTokenData = mergeMarketTokenDetailPrice({
      currentTokenDetail: get(tokenDetailAtom()),
      tokenData,
      requestStartedAt,
    });

    set(tokenDetailAtom(), finalTokenData);
    set(tokenDetailPreviewAtom(), undefined);
    set(tokenDetailWebsocketAtom(), undefined);
    set(isNativeAtom(), selectedVariant.isNative);

    return assetDetail;
  } catch (error) {
    if (!isCurrentIdentity()) {
      isStale = true;
    }
    if (!isStale) {
      if (get(marketPerpsResolutionAtom())?.status === 'pending') {
        set(marketPerpsResolutionAtom(), {
          ...resolution,
          status: 'error',
        });
      }
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
