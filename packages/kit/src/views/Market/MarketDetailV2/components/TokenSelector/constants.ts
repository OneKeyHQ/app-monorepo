import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const TOKEN_SELECTOR_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 15,
});

export const TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS = [
  'transactions',
  'uniqueTraders',
  'holders',
  'tokenAge',
] as const;
