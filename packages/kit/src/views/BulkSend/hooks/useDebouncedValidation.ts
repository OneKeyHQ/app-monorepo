import { useCallback, useEffect, useRef } from 'react';

export function useDebouncedValidation<T extends string>(
  validateFn: (value: T) => Promise<string | boolean>,
  delay = 300,
) {
  const currentValueRef = useRef<T>('' as T);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResolveRef = useRef<((value: string | boolean) => void) | null>(
    null,
  );

  // Cleanup timer on unmount to avoid memory leaks
  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Resolve any pending promise on unmount to prevent hanging
      if (pendingResolveRef.current) {
        pendingResolveRef.current(true);
        pendingResolveRef.current = null;
      }
    },
    [],
  );

  return useCallback(
    (value: T): Promise<string | boolean> =>
      new Promise((resolve) => {
        currentValueRef.current = value;

        // Resolve previous pending promise to prevent hanging
        if (pendingResolveRef.current) {
          pendingResolveRef.current(true);
        }
        pendingResolveRef.current = resolve;

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

        debounceTimerRef.current = setTimeout(async () => {
          try {
            const result = await validateFn(value);
            if (
              currentValueRef.current === value &&
              pendingResolveRef.current === resolve
            ) {
              resolve(result);
              pendingResolveRef.current = null;
            }
          } catch {
            // Resolve with false on error to prevent hanging validation
            if (
              currentValueRef.current === value &&
              pendingResolveRef.current === resolve
            ) {
              resolve(false);
              pendingResolveRef.current = null;
            }
          }
        }, delay);
      }),
    [validateFn, delay],
  );
}
