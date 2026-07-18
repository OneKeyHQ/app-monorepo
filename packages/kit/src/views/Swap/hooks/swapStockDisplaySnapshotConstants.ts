import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ week: 1 });
