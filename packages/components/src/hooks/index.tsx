import type { DependencyList, EffectCallback } from 'react';
import { useEffect, useRef } from 'react';

export * from './useBackHandler';
export * from './useClipboard';
export * from './useColor';
export * from './useDeferredPromise';
export * from './useForm';
export * from './useKeyboard';
export * from './useLayout';
export * from './useNetInfo';
export * from './useOrientation';
export * from './usePreventRemove';
export * from './useShare';
export * from './useShortcuts';
export * from './useStyle';
export * from './useVisibilityChange';
export * from './useModalNavigatorContext';

export function useFirstMountState() {
  const isFirst = useRef(true);
  if (isFirst.current) {
    isFirst.current = false;
    return true;
  }
  return isFirst.current;
}

// https://github.com/streamich/react-use/blob/master/src/useUpdateEffect.ts
export function useUpdateEffect(
  effect: EffectCallback,
  deps?: DependencyList,
): void {
  const isFirstMount = useFirstMountState();
  useEffect(() => {
    if (!isFirstMount) {
      return effect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
