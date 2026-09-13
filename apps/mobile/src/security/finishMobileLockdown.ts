type IMobileRuntime = 'main' | 'background';

export type IMobileLockdownState = Readonly<{
  enabled: boolean;
  runtime: IMobileRuntime;
  lockdownApplied: boolean;
  evalTaming?: 'unsafe-eval';
}>;

type IMobileLockdownGlobal = typeof globalThis & {
  hardenIntrinsics?: () => void;
  harden?: (value: unknown) => unknown;
  __ONEKEY_MOBILE_LOCKDOWN_STATE__?: IMobileLockdownState;
};

// This module must stay free of runtime imports: it runs before wallet services,
// storage initialization, or the background transport in each isolated JS heap.
export function finishMobileLockdown(
  runtime: IMobileRuntime,
): IMobileLockdownState {
  const mode = process.env.ONEKEY_MOBILE_LOCKDOWN;
  if (mode !== undefined && mode !== 'true' && mode !== 'false') {
    // eslint-disable-next-line onekey/no-raw-error, no-restricted-syntax -- validate build mode before loading app error infrastructure
    throw new Error('ONEKEY_MOBILE_LOCKDOWN must be true or false.');
  }
  const enabled = mode !== 'false';
  const g = globalThis as IMobileLockdownGlobal;
  const previous = g.__ONEKEY_MOBILE_LOCKDOWN_STATE__;
  if (previous) {
    if (previous.enabled !== enabled || previous.runtime !== runtime) {
      // eslint-disable-next-line onekey/no-raw-error, no-restricted-syntax -- no app dependencies may load before hardening
      throw new Error(
        'Mobile lockdown runtime or build mode changed without a restart.',
      );
    }
    return previous;
  }

  if (enabled) {
    if (typeof g.hardenIntrinsics !== 'function') {
      // eslint-disable-next-line onekey/no-raw-error, no-restricted-syntax -- startup must fail if the security prelude is missing
      throw new Error('Mobile lockdown repair prelude is missing.');
    }
    // RN InitializeCore and the vetted synchronous OneKey shims have now run.
    // Exceptions intentionally propagate: a partly repaired realm cannot roll back.
    g.hardenIntrinsics();
    if (
      typeof g.harden !== 'function' ||
      !Object.isFrozen(Object.prototype) ||
      !Object.isFrozen(Array.prototype) ||
      !Object.isFrozen(Function.prototype) ||
      !Object.isFrozen(Promise.prototype)
    ) {
      // eslint-disable-next-line onekey/no-raw-error, no-restricted-syntax -- startup integrity failure before app error infrastructure
      throw new Error(
        'Mobile lockdown did not harden the JavaScript intrinsics.',
      );
    }
  }

  const state: IMobileLockdownState = Object.freeze({
    enabled,
    runtime,
    lockdownApplied: enabled,
    evalTaming: enabled ? 'unsafe-eval' : undefined,
  });
  Object.defineProperty(g, '__ONEKEY_MOBILE_LOCKDOWN_STATE__', {
    value: state,
    configurable: false,
    writable: false,
  });
  return state;
}
