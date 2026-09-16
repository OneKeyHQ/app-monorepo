import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import type {
  IMarketListingWatchlistQuote,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';

export type IWatchlistListingPreview = {
  logoUrl?: string;
  name?: string;
  symbol?: string;
};

type IWatchlistListingIdentity = Pick<
  IMarketWatchListItemV2,
  'assetId' | 'stockId' | 'chainId' | 'contractAddress'
>;

const listingPreviews = new Map<string, IWatchlistListingPreview>();

function trimmedPreview(
  preview: IWatchlistListingPreview,
): IWatchlistListingPreview | undefined {
  const logoUrl = preview.logoUrl?.trim();
  const name = preview.name?.trim();
  const symbol = preview.symbol?.trim();
  if (!logoUrl && !name && !symbol) {
    return undefined;
  }
  return { logoUrl, name, symbol };
}

export function rememberWatchlistListingPreview(
  item: IWatchlistListingIdentity,
  preview: IWatchlistListingPreview,
) {
  const next = trimmedPreview(preview);
  if (!next) {
    return;
  }
  listingPreviews.set(getMarketWatchlistKey(item), next);
}

/** Keep the star-time preview current so a later failed poll does not regress. */
export function syncWatchlistListingPreviewFromQuote(
  item: IWatchlistListingIdentity,
  quote: Pick<IMarketListingWatchlistQuote, 'name' | 'symbol' | 'logoUrl'>,
) {
  rememberWatchlistListingPreview(item, {
    name: quote.name,
    symbol: quote.symbol,
    logoUrl: quote.logoUrl || '',
  });
}

export function getWatchlistListingPreview(
  item: IWatchlistListingIdentity,
): IWatchlistListingPreview | undefined {
  return listingPreviews.get(getMarketWatchlistKey(item));
}

export function forgetWatchlistListingPreview(item: IWatchlistListingIdentity) {
  listingPreviews.delete(getMarketWatchlistKey(item));
}

export function clearWatchlistListingPreviews() {
  listingPreviews.clear();
}

export function resolveListingWatchlistDisplay({
  watchlistItem,
  quote,
}: {
  watchlistItem: IWatchlistListingIdentity;
  quote?: Pick<
    IMarketListingWatchlistQuote,
    'name' | 'symbol' | 'logoUrl' | 'variants'
  >;
}) {
  const preview = getWatchlistListingPreview(watchlistItem);
  const fallbackId = watchlistItem.assetId ?? watchlistItem.stockId ?? '';
  return {
    name: quote?.name || preview?.name || fallbackId,
    symbol: quote?.symbol || preview?.symbol || fallbackId,
    tokenImageUri: quote ? quote.logoUrl || '' : preview?.logoUrl || '',
    stockVariants: quote?.variants,
  };
}
