import timerUtils from '../utils/timerUtils';

export const PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    week: 1,
  });

export const PERPS_FAVORITES_BAR_MARKET_CACHE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    month: 1,
  });

export const PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS = timerUtils.getTimeDurationMs({
  week: 1,
});

export const PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    seconds: 30,
  });

export const PERPS_ALL_DEXS_ASSET_CTXS_CACHE_WRITE_INTERVAL_MS =
  timerUtils.getTimeDurationMs({
    seconds: 30,
  });

export const PERPS_L2_BOOK_SNAPSHOT_CACHE_WRITE_INTERVAL_MS =
  timerUtils.getTimeDurationMs({
    seconds: 30,
  });

export const PERPS_L2_BOOK_SNAPSHOT_CACHE_MIN_LEVELS_PER_SIDE = 16;

export const PERPS_SNAPSHOT_CACHE_MAX_ENTRIES = 24;

export const PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    week: 1,
  });

export const PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MIN_WRITE_INTERVAL_MS =
  timerUtils.getTimeDurationMs({
    seconds: 30,
  });

export const PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_ENTRIES = 24;

export const PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    month: 1,
  });

export const PERPS_ACCOUNT_DISPLAY_CACHE_WRITE_INTERVAL_MS =
  timerUtils.getTimeDurationMs({
    seconds: 5,
  });

export const PERPS_ACCOUNT_DISPLAY_CACHE_MAX_ENTRIES = 16;

export const PERPS_ACCOUNT_DISPLAY_SNAPSHOT_MAX_ENTRIES = 8;
