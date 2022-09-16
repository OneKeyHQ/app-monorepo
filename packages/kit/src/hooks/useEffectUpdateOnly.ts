import { DependencyList, EffectCallback, useEffect, useRef } from 'react';

function useEffectUpdateOnly(effect: EffectCallback, deps?: DependencyList) {
  const firstUpdate = useRef(true);
  // useLayoutEffect support?
  useEffect(
    () => {
      if (firstUpdate.current) {
        firstUpdate.current = false;
        return;
      }
      effect();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
}

export { useEffectUpdateOnly };
