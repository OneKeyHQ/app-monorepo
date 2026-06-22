// cspell:ignore lockdown
import type { ISesHardenLevel, ISesHardenRuntime } from './types';

// Edit this file to switch SES harden level synchronously at bundle startup.
// L0: disabled. L1: lockdown with unsafe eval. L2: lockdown with safe-eval.
export const ONEKEY_SES_HARDEN_DEFAULT_LEVEL: ISesHardenLevel = 'L2';

// Use runtime-specific overrides when a platform needs a different rollout pace.
export const ONEKEY_SES_HARDEN_RUNTIME_LEVELS: Partial<
  Record<ISesHardenRuntime, ISesHardenLevel>
> = {
  // web: 'L1',
  // 'desktop-renderer': 'L1',
  // 'ext-ui': 'L1',
  // 'ext-background': 'L1',
  // 'ext-offscreen': 'L1',
  // 'ext-passkey': 'L1',
};

export function getConfiguredSesHardenLevel(
  runtime?: ISesHardenRuntime,
): ISesHardenLevel {
  return (
    (runtime ? ONEKEY_SES_HARDEN_RUNTIME_LEVELS[runtime] : undefined) ??
    ONEKEY_SES_HARDEN_DEFAULT_LEVEL
  );
}
