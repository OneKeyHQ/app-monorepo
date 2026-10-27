import platformEnv from '../platformEnv';

type INextTickCallback = (...args: unknown[]) => void;
type INextTick = (callback: INextTickCallback, ...args: unknown[]) => void;
type IScheduler = (callback: () => void) => unknown;

export type INextTickRuntimeScope = {
  process?: { nextTick?: INextTick };
  setImmediate?: IScheduler;
  queueMicrotask?: IScheduler;
  setTimeout?: (callback: () => void, ms?: number) => unknown;
};

export type INextTickRuntimeEnv = {
  isNativeAndroid?: boolean;
  isNativeBackgroundThread?: boolean;
};

/**
 * Android background-runtime `process.nextTick` fix.
 *
 * The npm `process` polyfill drives its nextTick queue through a `setTimeout`
 * captured at module load. On the Android background runtime that capture
 * happens before `@onekeyfe/react-native-background-thread` installs its JSI
 * timers, so it holds React Native's own timer host function, which never
 * fires on the never-resumed background ReactHost: the queue grows and nothing
 * drains.
 *
 * `next-tick` (used by memoizee's promise/maxAge extensions) grabs
 * `process.nextTick` by reference the moment it loads, so this replacement has
 * to be installed right after the process polyfill and before any other module
 * evaluates. A late replacement only helps callers that read
 * `process.nextTick` lazily (npm `pbkdf2` behind cardano-crypto's
 * `mnemonicToRootKeypair`, which used to hang Cardano address creation);
 * memoizee caches would otherwise never see their promise settle, never arm
 * their maxAge timers and never expire (OK-63999).
 *
 * The scheduler is resolved on every call so the JSI-backed `setImmediate`
 * installed later is picked up automatically.
 */
export function installAndroidBackgroundProcessNextTick(
  scope: INextTickRuntimeScope = globalThis as INextTickRuntimeScope,
  env: INextTickRuntimeEnv = platformEnv,
): boolean {
  if (!env.isNativeAndroid || !env.isNativeBackgroundThread) {
    return false;
  }
  if (!scope.process) {
    scope.process = {};
  }
  scope.process.nextTick = function nextTickViaSetImmediate(
    callback: INextTickCallback,
    ...args: unknown[]
  ) {
    const run = () => {
      callback(...args);
    };
    if (typeof scope.setImmediate === 'function') {
      scope.setImmediate(run);
      return;
    }
    if (typeof scope.queueMicrotask === 'function') {
      scope.queueMicrotask(run);
      return;
    }
    scope.setTimeout?.(run, 0);
  };
  return true;
}
