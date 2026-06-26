import { defaultLogger } from '../../logger/logger';

const LOG_PREFIX = '[ACC-SELECTOR-REPRO]';

export function debugAccountSelectorLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  defaultLogger.accountSelector.debug.repro(`${LOG_PREFIX} ${label}`, value);
}
