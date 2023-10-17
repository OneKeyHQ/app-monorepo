import { useDebounce as useDebounceOriginal } from 'use-debounce';

export function useDebounce<T>(
  value: T,
  delay: number,
  options?: {
    maxWait?: number;
    leading?: boolean;
    trailing?: boolean;
    equalityFn?: (left: T, right: T) => boolean;
  },
): T {
  const [debounce] = useDebounceOriginal(value, delay, options);
  return debounce;
}
