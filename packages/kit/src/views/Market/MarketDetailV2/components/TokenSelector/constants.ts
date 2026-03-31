import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const TOKEN_SELECTOR_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 15,
});
