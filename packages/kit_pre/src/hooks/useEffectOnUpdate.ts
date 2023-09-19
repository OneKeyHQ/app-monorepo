import type { DependencyList, EffectCallback } from 'react';
import { useEffect, useRef } from 'react';

function useEffectOnUpdate(effect: EffectCallback, deps?: DependencyList) {
  const firstUpdate = useRef(true);

  // useLayoutEffect
  return useEffect(
    () => {
      if (firstUpdate.current) {
        firstUpdate.current = false;
        return;
      }
      effect();
    },
    // eslint-disable-next-line  react-hooks/exhaustive-deps
    deps,
  );
}

export { useEffectOnUpdate };
