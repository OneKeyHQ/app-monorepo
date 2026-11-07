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
  get,
  set,
  symbol,
  resolution,
}: {
  get: IJotaiGetter;
  set: IJotaiSetter;
  symbol: string;
  resolution: {
    networkId: string;
    tokenAddress: string;
    requestId: number;
  };
}) {
  const isCurrentIdentity = () =>
    get(marketPerpsResolutionAtom())?.lookupRequestId ===
      resolution.requestId &&
    get(marketPerpsResolutionAtom())?.requestId ===
      get(tokenDetailRequestIdAtom()) &&
    get(tokenAddressAtom()) === resolution.tokenAddress &&
    get(networkIdAtom()) === resolution.networkId;
  const settle = (status: 'resolved' | 'error') => {
    const current = get(marketPerpsResolutionAtom());
    if (current && isCurrentIdentity()) {
      set(marketPerpsResolutionAtom(), {
        ...current,
        lookupRequestId: undefined,
        status,
      });
    }
  };
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
    settle('resolved');
  } catch (error) {
    settle('error');
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
  // Checks that the detail route still owns the shared store. Asset-only routes
  // pass it so an unmounted/hidden route cannot write another page's atoms.
  isCurrentRequest?: () => boolean;
}

async function fetchMarketAssetTokenDetail(
  get: IJotaiGetter,
  set: IJotaiSetter,
  payload: IMarketAssetTokenDetailPayload,
): Promise<IMarketAssetDetailData> {
  const { assetId, variantId, tokenAddress, networkId, isCurrentRequest } =
    payload;
  const requestStartedAt = Date.now();
  // Asset-only routes carry no chain identity until the asset response resolves
  // a variant; the request must not guess it from the shared store.
  const isAssetOnly = !tokenAddress && !networkId;
  const requestId = get(tokenDetailRequestIdAtom()) + 1;
  set(tokenDetailRequestIdAtom(), requestId);
  const resolution:
    | { networkId: string; tokenAddress: string; requestId: number }
    | undefined = isAssetOnly
    ? undefined
    : { networkId, tokenAddress, requestId };
  if (resolution) {
    const previousResolution = get(marketPerpsResolutionAtom());
    const sameResolutionIdentity =
      previousResolution?.networkId === networkId &&
      previousResolution.tokenAddress === tokenAddress &&
      previousResolution.requestId === requestId - 1;
    set(marketPerpsResolutionAtom(), {
      ...resolution,
      lookupRequestId: sameResolutionIdentity
        ? previousResolution?.lookupRequestId
        : undefined,
      status: sameResolutionIdentity
        ? (previousResolution?.status ?? 'pending')
        : 'pending',
    });
  }
  let isStale = false;
  let resolvedIdentity:
    | {
        tokenAddress: string;
        networkId: string;
      }
    | undefined;
  const requestScopeStillMatches = () =>
    get(tokenDetailRequestIdAtom()) === requestId &&
    (isCurrentRequest?.() ?? true);
  const isCurrentIdentity = () => {
    if (!requestScopeStillMatches()) {
      return false;
    }
    if (isAssetOnly) {
      // Before the variant resolves there is no route identity to compare with.
      // Afterwards the shared atoms must still point at the resolved token.
      return resolvedIdentity
        ? get(tokenAddressAtom()) === resolvedIdentity.tokenAddress &&
            get(networkIdAtom()) === resolvedIdentity.networkId
        : true;
    }
    return (
      get(tokenAddressAtom()) === tokenAddress &&
      get(networkIdAtom()) === networkId
    );
  };

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

    // Perps state can only be bound once the route identity is known.
    const perpsResolution = resolution ?? {
      networkId: detailNetworkId,
      tokenAddress: detailTokenAddress,
      requestId,
    };
    if (!resolution) {
      const previousResolution = get(marketPerpsResolutionAtom());
      const sameResolutionIdentity =
        previousResolution?.networkId === perpsResolution.networkId &&
        previousResolution.tokenAddress === perpsResolution.tokenAddress;
      set(marketPerpsResolutionAtom(), {
        ...perpsResolution,
        lookupRequestId: sameResolutionIdentity
          ? previousResolution?.lookupRequestId
          : undefined,
        status: sameResolutionIdentity
          ? (previousResolution?.status ?? 'pending')
          : 'pending',
      });
    }
    // Asset polling must not invalidate an in-flight lookup for the same token.
    const currentResolution = get(marketPerpsResolutionAtom());
    if (currentResolution?.lookupRequestId === undefined) {
      set(marketPerpsResolutionAtom(), {
        ...perpsResolution,
        status: currentResolution?.status ?? 'pending',
        lookupRequestId: requestId,
      });
      void applyMarketAssetPerpsInfo({
        get,
        set,
        symbol: assetDetail.asset.symbol.toUpperCase(),
        resolution: perpsResolution,
      });
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
    // Native precision belongs to the chain; listing previews may contain 0.
    // Selector/list placeholders for asset entries can also carry a fake
    // precision (0), so asset-only routes only trust the resolved detail.
    const nativeDecimals = selectedVariant.isNative
      ? networkUtils.getLocalNetworkInfo(selectedVariant.networkId)?.decimals
      : undefined;
    let decimals = nativeDecimals;
    if (decimals === undefined) {
      decimals =
        !isAssetOnly && previewMatchesRoute
          ? tokenDetailPreview?.decimals
          : currentDecimals;
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
      const metadataTokenAddress = selectedVariant.tokenAddress;
      const metadataNetworkId = selectedVariant.networkId;
      // Metadata may settle after a newer price poll. Only route ownership and
      // the still-current token identity decide whether its precision applies.
      const metadataStillApplies = () =>
        (isCurrentRequest?.() ?? true) &&
        get(tokenAddressAtom()) === metadataTokenAddress &&
        get(networkIdAtom()) === metadataNetworkId;
      void backgroundApiProxy.serviceToken
        .fetchTokenInfoOnly({
          networkId: metadataNetworkId,
          tokenAddress: metadataTokenAddress,
        })
        .then((tokenInfo) => {
          const resolvedDecimals = tokenInfo?.info?.decimals;
          if (
            !isValidTokenDecimals(resolvedDecimals) ||
            !metadataStillApplies()
          ) {
            return;
          }
          const latestTokenDetail = get(tokenDetailAtom());
          if (
            latestTokenDetail &&
            isSameMarketTokenDetail({
              tokenDetail: latestTokenDetail,
              tokenAddress: metadataTokenAddress,
              networkId: metadataNetworkId,
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

    return assetDetail;
  } catch (error) {
    if (!isCurrentIdentity()) {
      isStale = true;
    }
    if (!isStale) {
      const currentResolution = get(marketPerpsResolutionAtom());
      if (
        currentResolution?.status === 'pending' &&
        currentResolution.lookupRequestId === undefined
      ) {
        set(marketPerpsResolutionAtom(), {
          ...currentResolution,
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
