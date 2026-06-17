// cspell:ignore lockdown
import { isExtensionRuntime } from './options';

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

// E2E (Playwright) builds disable SES lockdown for extension runtimes only.
// Playwright's evaluate/worker.evaluate inject a UtilityScript that calls the
// target context's `eval` to reconstruct the serialized function. MV3 forbids
// `'unsafe-eval'` in the extension CSP (Chrome rejects the manifest), and any
// SES eval taming other than `'no-eval'` makes `lockdown()` throw a CSP
// EvalError at startup — so the extension can neither relax CSP nor keep
// lockdown with a usable `eval`. Forcing L0 (no lockdown) keeps the native
// `eval` intact so the e2e harness can drive the extension (paired with
// Playwright `bypassCSP: true`). `process.env.E2E_MODE` is inlined by
// DefinePlugin and is only `'true'` in e2e builds, so production extension
// builds are unaffected. Non-extension runtimes (web/desktop) keep their
// configured level under E2E because their CSP already permits eval.
function isExtensionE2EBuild(runtime?: ISesHardenRuntime): boolean {
  return process.env.E2E_MODE === 'true' && isExtensionRuntime(runtime);
}

export function getConfiguredSesHardenLevel(
  runtime?: ISesHardenRuntime,
): ISesHardenLevel {
  if (isExtensionE2EBuild(runtime)) {
    return 'L0';
  }
  return (
    (runtime ? ONEKEY_SES_HARDEN_RUNTIME_LEVELS[runtime] : undefined) ??
    ONEKEY_SES_HARDEN_DEFAULT_LEVEL
  );
}
