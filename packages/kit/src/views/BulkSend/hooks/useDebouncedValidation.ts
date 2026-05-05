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
  // Track the last validation result so cancelled promises preserve error state
  const lastResultRef = useRef<string | boolean>(true);

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

        // Resolve previous pending promise with last known result to preserve
        // error state. Using `true` here would momentarily clear form errors
        // on Android where controlled TextInput can re-fire onChangeText.
        if (pendingResolveRef.current) {
          pendingResolveRef.current(lastResultRef.current);
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
              lastResultRef.current = result;
              resolve(result);
              pendingResolveRef.current = null;
            }
          } catch {
            // Resolve with false on error to prevent hanging validation
            if (
              currentValueRef.current === value &&
              pendingResolveRef.current === resolve
            ) {
              lastResultRef.current = false;
              resolve(false);
              pendingResolveRef.current = null;
            }
          }
        }, delay);
      }),
    [validateFn, delay],
  );
}
