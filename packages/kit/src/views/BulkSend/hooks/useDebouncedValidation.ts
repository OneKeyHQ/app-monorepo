import { useCallback, useEffect, useMemo, useRef } from 'react';

type IDebouncedValidation<T extends string> = {
  validate: (value: T) => Promise<string | boolean>;
  cancel: (result?: string | boolean) => void;
};

export function useDebouncedValidation<T extends string>(
  validateFn: (value: T) => Promise<string | boolean>,
  delay = 300,
): IDebouncedValidation<T> {
  // Keep the latest validateFn in a ref so identity churn (e.g. `network` /
  // `vaultSettings` resolving asynchronously while the user is entering
  // addresses) never cancels an in-flight validation. Previously, a changed
  // validateFn force-resolved the pending validation to `false`, which left the
  // field invalid with an empty error message: react-hook-form renders no error
  // text for a boolean-`false` result, so the Next button stayed disabled and
  // invalid addresses produced no visible error. When the debounce fires we
  // always run the current validator, so the value is re-checked with the
  // freshest network/token context and resolves with the real result.
  const validateFnRef = useRef(validateFn);
  validateFnRef.current = validateFn;

  const currentValueRef = useRef<T>('' as T);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResolveRef = useRef<((value: string | boolean) => void) | null>(
    null,
  );
  const validationVersionRef = useRef(0);
  // Track the last validation result so cancelled promises preserve error state
  const lastResultRef = useRef<string | boolean>(true);

  const cancel = useCallback((result = lastResultRef.current) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingResolveRef.current) {
      pendingResolveRef.current(result);
      pendingResolveRef.current = null;
    }
  }, []);

  // Clean up pending validation on unmount.
  useEffect(
    () => () => {
      validationVersionRef.current += 1;
      cancel();
    },
    [cancel],
  );

  const validate = useCallback(
    (value: T): Promise<string | boolean> =>
      new Promise((resolve) => {
        currentValueRef.current = value;
        const validationVersion = validationVersionRef.current;

        // Resolve previous pending promise with last known result to preserve
        // error state. Using `true` here would momentarily clear form errors
        // on Android where controlled TextInput can re-fire onChangeText.
        cancel();
        pendingResolveRef.current = resolve;

        debounceTimerRef.current = setTimeout(async () => {
          debounceTimerRef.current = null;
          try {
            const result = await validateFnRef.current(value);
            if (
              validationVersionRef.current === validationVersion &&
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
              validationVersionRef.current === validationVersion &&
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
    [cancel, delay],
  );

  return useMemo(() => ({ validate, cancel }), [validate, cancel]);
}
