import { useCallback, useState } from 'react';

import { useIsMounted } from './useIsMounted';

function useStateMountedOnly<T>(
  initialState: T | (() => T),
): [T, (val: T | ((state: T) => T)) => void] {
  const isMountedRef = useIsMounted();
  const [value, updateValue] = useState<T>(initialState);
  const setValue = useCallback(
    (val: T | ((state: T) => T)) => {
      if (isMountedRef.current) updateValue(val);
    },
    [isMountedRef],
  );
  return [value, setValue];
}

export { useStateMountedOnly };
