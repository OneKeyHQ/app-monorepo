import type { Dispatch, SetStateAction } from 'react';
import { useLayoutEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * WORKAROUND: Temporary fix for iOS native rendering bug.
 *
 * TODO: Remove this hook once the underlying iOS native component bug is fixed.
 * The community's native layer optimization has introduced a regression that requires
 * delayed state initialization to work properly.
 */
export function useDelayedState<T>(
  initialValue: T,
  fallbackValue?: T,
  delay = 100,
): [T, Dispatch<SetStateAction<T>>] {
  const shouldDelay = platformEnv.isNativeIOS;

  const effectiveFallbackValue =
    fallbackValue !== undefined
      ? fallbackValue
      : ((typeof initialValue === 'number' ? 0 : undefined) as T);

  const [value, setValue] = useState<T>(
    shouldDelay ? effectiveFallbackValue : initialValue,
  );

  useLayoutEffect(() => {
    if (shouldDelay) {
      const timer = setTimeout(() => {
        setValue(initialValue);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [initialValue, delay, shouldDelay]);

  return [value, setValue];
}
