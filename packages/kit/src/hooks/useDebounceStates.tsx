import { useEffect, useRef, useState } from 'react';

/*
  return useDebounceStates(1000, {
    accountTokens,
    updateInfo,
    network,
    loading,
  });
*/

export const useDebounceStates = <T extends object>(
  time = 250,
  states: T,
): Partial<T> => {
  console.error('useDebounceStates not ready yet');

  const [data, setState] = useState<Partial<T>>({} as Partial<T>);
  const result = useRef<T | undefined>(undefined);
  const refTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  if (refTimeout.current) {
    clearTimeout(refTimeout.current);
  }

  const selectorData = states;

  useEffect(
    () => () => {
      if (refTimeout.current) {
        clearTimeout(refTimeout.current);
      }
    },
    [],
  );

  if (time === 0) {
    return selectorData;
  }

  refTimeout.current = setTimeout(() => {
    if (result.current !== selectorData) {
      setState(selectorData);
      result.current = selectorData;
    }
  }, time);

  return data;
};
