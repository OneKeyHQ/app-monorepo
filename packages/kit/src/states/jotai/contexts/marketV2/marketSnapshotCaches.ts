import { createNamespacedSnapshotCache } from '@onekeyhq/shared/src/storage/SnapshotCache';
import type {
  IMarketPerpsInfo,
  IMarketTokenDetail,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';

export type IMarketTokenDetailSnapshot = {
  token: IMarketTokenDetail;
  websocket?: IMarketTokenDetailWebsocket;
  perpsInfo?: IMarketPerpsInfo;
};

// A cached detail only seeds the first frame; polling replaces it right away.
// Past a day the quote is too old to be worth showing even briefly.
const TOKEN_DETAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Recently browsed tokens, not a history. Measured at ~5KB each, so this is
// well under a megabyte even when full.
const TOKEN_DETAIL_MAX_ENTRIES = 30;

/**
 * Detail payloads for the market detail page, keyed by network, address,
 * currency and locale.
 *
 * On native this is its own MMKV file, and on web its own key space in the
 * shared snapshot database: browsing many tokens cannot push other features
 * out of the shared cold-start budget, and nothing is loaded at startup
 * because a read names its key.
 */
export const marketTokenDetailSnapshotCache =
  createNamespacedSnapshotCache<IMarketTokenDetailSnapshot>({
    namespace: 'market-token-detail',
    maxAgeMs: TOKEN_DETAIL_MAX_AGE_MS,
    maxEntries: TOKEN_DETAIL_MAX_ENTRIES,
  });
