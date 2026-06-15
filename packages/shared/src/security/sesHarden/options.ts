// cspell:ignore lockdown LOCKDOWN Lockdown
import type { ISesHardenLevel } from './types';
import type { LockdownOptions } from 'ses';

export const SES_HARDEN_LOOSE_LOCKDOWN_OPTIONS = {
  errorTaming: 'unsafe-debug',
  errorTrapping: 'none',
  reporting: 'console',
  unhandledRejectionTrapping: 'none',
  regExpTaming: 'unsafe',
  localeTaming: 'unsafe',
  consoleTaming: 'unsafe',
  overrideTaming: 'moderate',
  stackFiltering: 'verbose',
  domainTaming: 'safe',
  evalTaming: 'unsafe-eval',
  legacyRegeneratorRuntimeTaming: 'safe',
} as const satisfies LockdownOptions;

export function getSesLockdownOptions(
  level: ISesHardenLevel,
): LockdownOptions | undefined {
  if (level === 'L0') {
    return undefined;
  }

  return {
    ...SES_HARDEN_LOOSE_LOCKDOWN_OPTIONS,
    evalTaming: level === 'L2' ? 'safe-eval' : 'unsafe-eval',
  };
}
