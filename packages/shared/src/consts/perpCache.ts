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

export const PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_ENTRIES = 16;

export const PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    minute: 1,
  });

// Open positions are marked to market, so refresh them faster than idle accounts.
export const PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    seconds: 15,
  });

// Serving a stale snapshot while a background refresh runs keeps account
// switches from blocking on the network; beyond this age show loading instead.
export const PERPS_HL_PORTFOLIO_STALE_SERVE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    hour: 24,
  });
