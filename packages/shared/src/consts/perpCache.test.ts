import {
  PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS,
  PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_AGE_MS,
  PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS,
  PERPS_FAVORITES_BAR_MARKET_CACHE_MAX_AGE_MS,
  PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
  PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS,
} from './perpCache';

const DAY_MS = 24 * 60 * 60 * 1000;
const SECOND_MS = 1000;

describe('perps cold-start cache TTLs', () => {
  it('keeps volatile market snapshots for one week', () => {
    expect(PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS).toBe(7 * DAY_MS);
    expect(PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS).toBe(7 * DAY_MS);
    expect(PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_AGE_MS).toBe(7 * DAY_MS);
  });

  it('keeps lower-risk display caches for one month', () => {
    expect(PERPS_FAVORITES_BAR_MARKET_CACHE_MAX_AGE_MS).toBe(31 * DAY_MS);
    expect(PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS).toBe(31 * DAY_MS);
  });

  it('keeps trading-sensitive cache gates short-lived', () => {
    expect(PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS).toBe(30 * SECOND_MS);
  });

  it('keeps trading interactivity much shorter than display caches', () => {
    [
      PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS,
      PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS,
      PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_AGE_MS,
      PERPS_FAVORITES_BAR_MARKET_CACHE_MAX_AGE_MS,
      PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS,
    ].forEach((displayTtl) => {
      expect(PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS).toBeLessThan(displayTtl);
    });
  });
});
