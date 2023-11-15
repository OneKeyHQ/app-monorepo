import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

export abstract class ContextJotaiActionsBase {}
export function memoJotaiActions<T>(fn: () => T) {
  return memoizee(fn);
}
