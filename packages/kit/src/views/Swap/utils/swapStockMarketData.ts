import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
} from '@onekeyhq/shared/src/utils/stockTokenVariant';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockDetailPreview,
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { buildStockSwapTokenFromMarketListToken } from '../hooks/swapStockChannelUtils';

export type ISwapStockAvailability =
  | 'pending'
  | 'ready'
  | 'unavailable'
  | 'error';

export type ISwapStockSelectionKind = 'ticker' | 'variant' | 'token';

export function resolveSwapStockTokenSelectionKind(
  token: ISwapToken,
  currentStockId?: string,
): ISwapStockSelectionKind {
  const targetStockId =
    resolveMarketStockId(token) ??
    token.stock?.underlyingAssetTicker?.trim().toUpperCase();
  return targetStockId &&
    currentStockId &&
    targetStockId !== currentStockId.trim().toUpperCase()
    ? 'ticker'
    : 'token';
}

export type ISwapStockSelectionOperation =
  | { phase: 'idle' }
  | {
      phase: 'resolving';
      kind: ISwapStockSelectionKind;
      stockPreview?: IMarketStockDetailPreview;
    }
  | {
      phase: 'applying';
      kind: ISwapStockSelectionKind;
      tokenKey: string;
    }
  | { phase: 'failed'; kind: ISwapStockSelectionKind };

export function resolveSwapStockLoadingScopes({
  operation,
  currentTokenKey,
  isTokenVariantPending,
}: {
  operation: ISwapStockSelectionOperation;
  currentTokenKey: string;
  isTokenVariantPending: boolean;
}) {
  // A selection owns these skeletons only until its exact token identity and
  // variant settle. Polling and quote requests keep their own loading state.
  const pending =
    operation.phase === 'resolving' ||
    (operation.phase === 'applying' &&
      (operation.tokenKey !== currentTokenKey || isTokenVariantPending));
  return {
    stock:
      pending &&
      (operation.phase === 'resolving' || operation.phase === 'applying') &&
      operation.kind === 'ticker',
    tradeTarget: pending,
    amountInput: pending,
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
}: {
  items: IMarketStockTokenVariant[];
  defaultTokenId?: string;
  query?: string;
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
    return getDefaultStockTokenVariant(explicitMatches, defaultTokenId);
  if (
    search &&
    (/^0x[0-9a-f]{40}$/i.test(search) ||
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(search))
  )
    return undefined;
  return getDefaultStockTokenVariant(items, defaultTokenId);
}

export async function fetchSwapStockVariantToken(
  variant: IMarketStockTokenVariant,
  stockId: string,
) {
  if (!isStockTokenVariantTradable(variant))
    throw new OneKeyLocalError('Stock token is unavailable');
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
      variant.contractAddress,
      variant.networkId,
      { autoHandleError: false, skipConvertCurrency: true },
    );
  const detail = response?.data?.token;
  const detailStockId = detail?.stock?.stockId?.trim().toLowerCase();
  const requestedStockId = stockId.trim().toLowerCase();
  if (
    response.code !== 0 ||
    !detail ||
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
  const token = buildStockSwapTokenFromMarketListToken({
    ...detail,
    networkId: detail.networkId ?? variant.networkId,
    stock: { ...detail.stock, stockId: detail.stock.stockId ?? stockId },
  });
  if (!token) throw new OneKeyLocalError('Stock token is unavailable');
  return { ...token, networkLogoURI: variant.networkLogoUrl };
}

export async function fetchSwapStockSelection(
  stock: IMarketStockPublicItem,
  query?: string,
) {
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants({
      stockId: stock.stockId,
    });
  const variant = selectSwapStockVariant({ ...response, query });
  if (!variant) throw new OneKeyLocalError('No tradable stock token');
  return fetchSwapStockVariantToken(variant, stock.stockId);
}
