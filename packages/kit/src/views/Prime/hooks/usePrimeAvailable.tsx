import { useMemo } from 'react';

export function usePrimeAvailable() {
  return useMemo(() => ({ isPrimeAvailable: true }), []);
}
