import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
} from '@onekeyhq/shared/src/utils/stockTokenVariant';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import { buildStockSwapTokenFromMarketListToken } from '../hooks/swapStockChannelUtils';

export type ISwapStockAvailability =
  | 'pending'
  | 'ready'
  | 'unavailable'
  | 'error';

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
