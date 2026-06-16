// cspell:ignore lockdown LOCKDOWN Lockdown
import type { ISesHardenLevel, ISesHardenRuntime } from './types';
import type { LockdownOptions } from 'ses';

export const SES_HARDEN_LOOSE_LOCKDOWN_OPTIONS = {
  errorTaming: 'unsafe-debug',
  errorTrapping: 'none',
  reporting: 'console',
  unhandledRejectionTrapping: 'none',
  regExpTaming: 'unsafe',
  localeTaming: 'unsafe',
  consoleTaming: 'unsafe',
  // 'severe' (not the SES default 'moderate') is required for a bundled app:
  // webpack/rollup write module exports onto Object.prototype-inheriting
  // objects, and libraries like axios/decimal.js assign `constructor` onto such
  // objects at init (the "override mistake"). Only 'severe' enables override for
  // all of Object.prototype, so those assignments shadow on the receiver
  // instead of throwing against the frozen intrinsic. Matches MetaMask's
  // posture. It does NOT weaken intrinsic integrity: shared prototypes stay
  // frozen and only per-receiver shadowing is allowed. A warm-up list (see
  // runtime.ts defaultWarmUpBeforeLockdown) is kept as defense-in-depth.
  // Behavior is locked down by sesHardenLibCompat.test.ts.
  overrideTaming: 'severe',
  stackFiltering: 'verbose',
  domainTaming: 'safe',
  evalTaming: 'unsafe-eval',
  legacyRegeneratorRuntimeTaming: 'safe',
} as const satisfies LockdownOptions;

// Extension runtimes ship with a CSP of `script-src 'self' 'wasm-unsafe-eval'`
// (see apps/ext/src/manifest/common.js). `'unsafe-eval'` is only injected for
// dev + non-MV3 builds. Both SES `'unsafe-eval'` (L1) and `'safe-eval'` (L2)
// rely on host `eval`/`new Function`, which that CSP forbids, so `lockdown()`
// would throw a CSP `EvalError` at startup and brick every extension context.
// Force `'no-eval'` for all extension runtimes regardless of the configured
// level, while keeping the remaining (non-eval) taming dimensions intact.
// Exported so the runtime self-check (runtimeCheck.ts) can reuse the exact
// same "is this an extension runtime" notion instead of re-deriving the
// `'ext-'` prefix logic. Accepts a plain string as well so callers holding a
// raw `state.runtime` value can pass it through without a cast.
export function isExtensionRuntime(
  runtime?: ISesHardenRuntime | string,
): boolean {
  return runtime?.startsWith('ext-') === true;
}

export function getSesLockdownOptions(
  level: ISesHardenLevel,
  runtime?: ISesHardenRuntime,
): LockdownOptions | undefined {
  if (level === 'L0') {
    return undefined;
  }

  let evalTaming: LockdownOptions['evalTaming'] =
    level === 'L2' ? 'safe-eval' : 'unsafe-eval';
  if (isExtensionRuntime(runtime)) {
    evalTaming = 'no-eval';
  }

  return {
    ...SES_HARDEN_LOOSE_LOCKDOWN_OPTIONS,
    evalTaming,
  };
}
