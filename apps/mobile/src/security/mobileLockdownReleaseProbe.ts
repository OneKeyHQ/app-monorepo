/* eslint-disable onekey/no-raw-error */
import type { IMobileLockdownState } from './finishMobileLockdown';

type IProbeGlobal = typeof globalThis & {
  harden?: (value: unknown) => unknown;
  __ONEKEY_MOBILE_LOCKDOWN_STATE__?: IMobileLockdownState;
};

// This test-build probe has no runtime imports and never reads wallet state.
export function captureMobileLockdownIntegrity(runtime: 'main' | 'background') {
  const g = globalThis as IProbeGlobal;
  const state = g.__ONEKEY_MOBILE_LOCKDOWN_STATE__;
  const binding = Object.getOwnPropertyDescriptor(
    g,
    '__ONEKEY_MOBILE_LOCKDOWN_STATE__',
  );
  let tamperBlocked = false;
  try {
    const originalPush = Array.prototype.push;
    Array.prototype.push = originalPush;
  } catch {
    tamperBlocked = true;
  }
  const result = {
    runtime: state?.runtime,
    enabled: state?.enabled,
    lockdownApplied: state?.lockdownApplied,
    evalTaming: state?.evalTaming,
    stateFrozen: Object.isFrozen(state),
    bindingImmutable:
      binding?.writable === false && binding?.configurable === false,
    objectFrozen: Object.isFrozen(Object.prototype),
    arrayFrozen: Object.isFrozen(Array.prototype),
    functionFrozen: Object.isFrozen(Function.prototype),
    promiseFrozen: Object.isFrozen(Promise.prototype),
    hardenPresent: typeof g.harden === 'function',
    tamperBlocked,
  };
  if (
    result.runtime !== runtime ||
    !result.enabled ||
    !result.lockdownApplied ||
    result.evalTaming !== 'unsafe-eval' ||
    !result.stateFrozen ||
    !result.bindingImmutable ||
    !result.objectFrozen ||
    !result.arrayFrozen ||
    !result.functionFrozen ||
    !result.promiseFrozen ||
    !result.hardenPresent ||
    !result.tamperBlocked
  ) {
    throw new Error('Mobile lockdown Release integrity check failed.');
  }
  return result;
}
