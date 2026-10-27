import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IStockDetailRequestResult,
  IStockTokenVariantsRequestResult,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import {
  buildMarketStockTokenMetadata,
  resolveMarketStockId,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
  normalizeStockIssuer,
} from '@onekeyhq/shared/src/utils/stockTokenVariant';
import {
  prefixOf,
  swrCacheNamespaces,
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockDetailPreview,
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildStockSwapTokenFromMarketListToken,
  getTokenIdentityKey,
} from '../hooks/swapStockChannelUtils';

import type { IStockTokenDetailFetchState } from './stockTokenDetailFreshness';

const STOCK_SELECTION_CACHE_TTL_MS = 60 * 1000;
const STOCK_VARIANTS_CACHE_TTL_MS = 6000;

export type ISwapStockTokenIdentityResult = {
  tokenIdentity: string;
  stock?: IMarketStockDetailPreview;
  failed: boolean;
};

function getCachedStockTokenDetail(
  token: Pick<ISwapToken, 'networkId' | 'contractAddress' | 'isNative'>,
  locale: string,
) {
  const scope = `${getTokenIdentityKey(token)}:${locale}`;
  const cached = swrCacheUtils.get<IStockTokenDetailFetchState>(
    swrKeys.swapStockTokenDetail({ tokenScope: scope }),
  );
  return cached?.scope === scope &&
    cached.token?.stock &&
    equalTokenNoCaseSensitive({
      token1: {
        networkId: cached.token.networkId ?? token.networkId,
        contractAddress: cached.token.address,
      },
      token2: token,
    })
    ? cached
    : undefined;
}

function getCachedStockIdentity(
  token: Pick<ISwapToken, 'networkId' | 'contractAddress'>,
) {
  const tokenIdentity = getTokenIdentityKey(token);
  const cached = swrCacheUtils.get<ISwapStockTokenIdentityResult>(
    swrKeys.swapStockTokenIdentity({ tokenScope: tokenIdentity }),
  );
  return cached?.tokenIdentity === tokenIdentity &&
    cached.failed === false &&
    resolveMarketStockId(cached.stock ?? {})
    ? cached.stock
    : undefined;
}

function getCachedStockIdFromVariants(token: ISwapToken, locale: string) {
  const keys = swrCacheUtils.keysByPrefix(
    `${prefixOf(swrCacheNamespaces.marketStockTokenVariants)}v1:`,
  );
  const stockIds = new Set(
    keys
      .filter((key) => key.endsWith(`:${locale}`))
      .flatMap((key) => {
        const cached = swrCacheUtils.get<IStockTokenVariantsRequestResult>(key);
        const parentId = resolveMarketStockId(cached ?? {});
        return parentId &&
          cached &&
          !cached.failed &&
          key ===
            swrKeys.marketStockTokenVariants({ stockId: parentId, locale }) &&
          Array.isArray(cached.items) &&
          cached.items.some((variant) =>
            equalTokenNoCaseSensitive({ token1: variant, token2: token }),
          )
          ? [parentId]
          : [];
      }),
  );
  // An aged list can establish the parent for display, never trading status.
  // Conflicting parents must go through the authoritative identity lookup.
  return stockIds.size === 1 ? Array.from(stockIds)[0] : undefined;
}

export function getCachedSwapStockId(token: ISwapToken, locale: string) {
  const stockId = resolveMarketStockId(token);
  if (stockId) return stockId;
  const cachedToken = getCachedStockTokenDetail(token, locale)?.token;
  return (
    resolveMarketStockId(cachedToken ?? {}) ??
    resolveMarketStockId(getCachedStockIdentity(token) ?? {}) ??
    getCachedStockIdFromVariants(token, locale)
  );
}

export function getCachedSwapStockAssetPreview(
  token: ISwapToken,
  locale: string,
) {
  const cachedIdentity = getCachedStockIdentity(token);
  const stockId = getCachedSwapStockId(token, locale);
  if (!stockId) return undefined;
  const cached = swrCacheUtils.get<IStockDetailRequestResult>(
    swrKeys.marketStockDetail({ stockId, locale }),
  );
  const stock =
    cached?.stockId?.trim().toUpperCase() === stockId &&
    resolveMarketStockId(cached.data ?? {}) === stockId
      ? cached.data
      : undefined;
  const identity =
    resolveMarketStockId(cachedIdentity ?? {}) === stockId
      ? cachedIdentity
      : undefined;
  return stock ?? identity;
}

export type ISwapStockAvailability =
  | 'pending'
  | 'ready'
  | 'unavailable'
  | 'error';

export type ISwapStockSelectionKind = 'ticker' | 'variant' | 'token';

export async function fetchSwapStockTokenIdentity(
  token: Pick<ISwapToken, 'networkId' | 'contractAddress'>,
) {
  const cached = getCachedStockIdentity(token);
  if (cached) return cached;
  const response = await backgroundApiProxy.serviceMarketV2.searchMarketStocks({
    query: token.contractAddress,
  });
  const stock = response.items.length === 1 ? response.items[0] : undefined;
  if (!stock || !resolveMarketStockId(stock)) {
    throw new OneKeyLocalError('Stock token identity is unavailable');
  }
  const variants =
    await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants({
      stockId: stock.stockId,
    });
  if (
    !variants.items.some((variant) =>
      equalTokenNoCaseSensitive({ token1: variant, token2: token }),
    )
  ) {
    throw new OneKeyLocalError('Stock token does not match the resolved stock');
  }
  return stock;
}

export async function resolveSwapStockSelectionToken(
  token: ISwapToken,
  locale?: string,
) {
  if (resolveMarketStockId(token)) return token;
  // Position metadata can omit stockId. Resolve the exact chain and contract
  // before committing, so stock detail never transitions through an empty id.
  const cachedStockId = locale
    ? getCachedSwapStockId(token, locale)
    : undefined;
  const stockId =
    cachedStockId ?? (await fetchSwapStockTokenIdentity(token)).stockId;
  return {
    ...token,
    isStock: true,
    stock: buildMarketStockTokenMetadata(token.stock, stockId),
  };
}

export function resolveSwapStockTokenSelectionKind(
  token: ISwapToken,
  currentStockId?: string,
): ISwapStockSelectionKind {
  const targetStockId =
    resolveMarketStockId(token) ??
    token.stock?.underlyingAssetTicker?.trim().toUpperCase();
  return !targetStockId ||
    (currentStockId && targetStockId !== currentStockId.trim().toUpperCase())
    ? 'ticker'
    : 'token';
}

export type ISwapStockSelectionOperation =
  | { phase: 'idle' }
  | { phase: 'checkingRisk'; kind: ISwapStockSelectionKind }
  | {
      phase: 'resolving';
      kind: ISwapStockSelectionKind;
      stockPreview?: IMarketStockDetailPreview;
    }
  | {
      phase: 'applying';
      kind: ISwapStockSelectionKind;
      tokenKey: string;
      stockPreview?: IMarketStockDetailPreview;
    }
  | { phase: 'failed'; kind: ISwapStockSelectionKind };

export function resolveSwapStockLoadingScopes({
  operation,
  currentTokenKey,
  isTokenVariantPending,
  isAutoVariantPending = false,
}: {
  operation: ISwapStockSelectionOperation;
  currentTokenKey: string;
  isTokenVariantPending: boolean;
  // A restored token waiting on the issuer rule: hold the trade target rather
  // than show a token that is about to change.
  isAutoVariantPending?: boolean;
}) {
  // A selection owns these skeletons only until its exact token identity and
  // variant settle. Polling and quote requests keep their own loading state.
  const identityPending =
    operation.phase === 'resolving' ||
    (operation.phase === 'applying' && operation.tokenKey !== currentTokenKey);
  // Asset display can use its scoped cache as soon as identity commits.
  // Variant confirmation continues to gate the independent trade target.
  const tradePending =
    isAutoVariantPending ||
    identityPending ||
    (operation.phase === 'applying' && isTokenVariantPending);
  return {
    stock:
      identityPending &&
      (operation.phase === 'resolving' || operation.phase === 'applying') &&
      operation.kind === 'ticker',
    tradeTarget: tradePending,
    amountInput: tradePending,
  };
}

export function resolveSwapStockAvailability({
  pending,
  failed,
  selectedVariant,
}: {
  pending: boolean;
  failed: boolean;
  selectedVariant?: IMarketStockTokenVariant;
}): ISwapStockAvailability {
  if (pending) return 'pending';
  if (selectedVariant)
    return isStockTokenVariantTradable(selectedVariant)
      ? 'ready'
      : 'unavailable';
  return failed ? 'error' : 'unavailable';
}

export function selectSwapStockVariant({
  items,
  defaultTokenId,
  query,
  preferredIssuer,
}: {
  items: IMarketStockTokenVariant[];
  defaultTokenId?: string;
  query?: string;
  preferredIssuer?: string;
}) {
  const search = query?.trim();
  const explicitMatches = search
    ? items.filter(
        (item) =>
          equalTokenNoCaseSensitive({
            token1: item,
            token2: { networkId: item.networkId, contractAddress: search },
          }) || item.symbol?.toLowerCase() === search.toLowerCase(),
      )
    : [];
  if (explicitMatches.length)
    return getDefaultStockTokenVariant(
      explicitMatches,
      defaultTokenId,
      preferredIssuer,
    );
  if (
    search &&
    (/^0x[0-9a-f]{40}$/i.test(search) ||
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(search))
  )
    return undefined;
  return getDefaultStockTokenVariant(items, defaultTokenId, preferredIssuer);
}

/**
 * The variant a restored or default-loaded stock token should move to under
 * the issuer rule, or undefined to keep it. A token already from the chosen
 * issuer stays put, so its network is not second-guessed.
 */
export function resolveSwapStockAutoVariant({
  variants,
  current,
  defaultTokenId,
  preferredIssuer,
}: {
  variants: IMarketStockTokenVariant[];
  // The variant the page currently trades, from the same list.
  current: IMarketStockTokenVariant;
  defaultTokenId?: string;
  preferredIssuer?: string;
}) {
  const target = getDefaultStockTokenVariant(
    variants,
    defaultTokenId,
    preferredIssuer,
  );
  if (!target || target.tokenId === current.tokenId) return undefined;
  // A token from the rule's issuer stays on its own network, unless it can no
  // longer trade and the same issuer has a tradable token elsewhere.
  if (
    normalizeStockIssuer(target.issuer) ===
      normalizeStockIssuer(current.issuer) &&
    isStockTokenVariantTradable(current)
  ) {
    return undefined;
  }
  return target;
}

export function getCachedSwapStockVariantToken(
  variant: IMarketStockTokenVariant,
  stockId: string,
  locale?: string,
) {
  if (!isStockTokenVariantTradable(variant)) return undefined;
  const cached = locale
    ? getCachedStockTokenDetail({ ...variant, isNative: false }, locale)
    : undefined;
  const age = Date.now() - (cached?.fetchedAt ?? 0);
  if (
    cached?.token &&
    cached.fetchedAt &&
    age >= 0 &&
    age < STOCK_SELECTION_CACHE_TTL_MS
  ) {
    try {
      // The detail's primary price is always USD (a display currency only
      // fills priceConverted), so the cached token keeps a correct USD price.
      return buildSwapStockVariantToken(variant, stockId, cached.token);
    } catch {
      // A malformed snapshot must go through the authoritative request.
    }
  }
  return undefined;
}

export async function fetchSwapStockVariantToken(
  variant: IMarketStockTokenVariant,
  stockId: string,
  locale?: string,
) {
  if (!isStockTokenVariantTradable(variant))
    throw new OneKeyLocalError('Stock token is unavailable');
  const cached = getCachedSwapStockVariantToken(variant, stockId, locale);
  if (cached) return cached;
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
      variant.contractAddress,
      variant.networkId,
      { autoHandleError: false, skipConvertCurrency: true },
    );
  if (response.code !== 0 || !response.data?.token) {
    throw new OneKeyLocalError(
      'Stock token detail does not match the selected variant',
    );
  }
  return buildSwapStockVariantToken(variant, stockId, response.data.token);
}

function buildSwapStockVariantToken(
  variant: IMarketStockTokenVariant,
  stockId: string,
  detail: IMarketTokenDetail,
) {
  const detailStockId = detail?.stock?.stockId?.trim().toLowerCase();
  const requestedStockId = stockId.trim().toLowerCase();
  if (
    !detail.stock ||
    (detail.networkId !== undefined &&
      detail.networkId !== variant.networkId) ||
    (detailStockId !== undefined && detailStockId !== requestedStockId) ||
    !equalTokenNoCaseSensitive({
      token1: {
        networkId: detail.networkId ?? variant.networkId,
        contractAddress: detail.address,
      },
      token2: variant,
    })
  ) {
    throw new OneKeyLocalError(
      'Stock token detail does not match the selected variant',
    );
  }
  if (
    detail.decimalsResolved === false ||
    !Number.isInteger(detail.decimals) ||
    detail.decimals < 0
  ) {
    throw new OneKeyLocalError('Stock token decimals are unavailable');
  }
  const token = buildStockSwapTokenFromMarketListToken({
    ...detail,
    firstTradeTime:
      detail.firstTradeTime === undefined
        ? undefined
        : String(detail.firstTradeTime),
    networkId: detail.networkId ?? variant.networkId,
    stock: { ...detail.stock, stockId: detail.stock.stockId ?? stockId },
  });
  if (!token) throw new OneKeyLocalError('Stock token is unavailable');
  return { ...token, networkLogoURI: variant.networkLogoUrl };
}

function getCachedSwapStockVariant(
  stock: IMarketStockPublicItem,
  query?: string,
  locale?: string,
  preferredIssuer?: string,
) {
  const normalizedStockId = stock.stockId.trim().toUpperCase();
  const cached = locale
    ? swrCacheUtils.getWithTimestamp<IStockTokenVariantsRequestResult>(
        swrKeys.marketStockTokenVariants({
          stockId: normalizedStockId,
          locale,
        }),
      )
    : undefined;
  const age = Date.now() - (cached?.updatedAt ?? 0);
  const cachedVariant =
    cached?.data.stockId?.trim().toUpperCase() === normalizedStockId &&
    !cached.data.failed &&
    age >= 0 &&
    age < STOCK_VARIANTS_CACHE_TTL_MS
      ? selectSwapStockVariant({ ...cached.data, query, preferredIssuer })
      : undefined;
  if (cachedVariant && isStockTokenVariantTradable(cachedVariant)) {
    return cachedVariant;
  }
  return undefined;
}

export function getCachedSwapStockSelection(
  stock: IMarketStockPublicItem,
  query?: string,
  locale?: string,
  preferredIssuer?: string,
) {
  const variant = getCachedSwapStockVariant(
    stock,
    query,
    locale,
    preferredIssuer,
  );
  return variant
    ? getCachedSwapStockVariantToken(variant, stock.stockId, locale)
    : undefined;
}

export async function fetchSwapStockSelection(
  stock: IMarketStockPublicItem,
  query?: string,
  locale?: string,
  preferredIssuer?: string,
) {
  const cached = getCachedSwapStockVariant(
    stock,
    query,
    locale,
    preferredIssuer,
  );
  if (cached) return fetchSwapStockVariantToken(cached, stock.stockId, locale);
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants({
      stockId: stock.stockId,
    });
  const variant = selectSwapStockVariant({
    ...response,
    query,
    preferredIssuer,
  });
  if (!variant) throw new OneKeyLocalError('No tradable stock token');
  return fetchSwapStockVariantToken(variant, stock.stockId, locale);
}
