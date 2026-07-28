import { useCallback, useEffect, useMemo, useRef } from 'react';

type IDebouncedValidation<T extends string> = {
  validate: (value: T) => Promise<string | boolean>;
  cancel: (result?: string | boolean) => void;
};

export function useDebouncedValidation<T extends string>(
  validateFn: (value: T) => Promise<string | boolean>,
  delay = 300,
): IDebouncedValidation<T> {
  const validateFnRef = useRef(validateFn);
  const validateFnVersionRef = useRef(0);
  if (validateFnRef.current !== validateFn) {
    validateFnRef.current = validateFn;
    validateFnVersionRef.current += 1;
  }

  const currentValueRef = useRef<T>('' as T);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResolveRef = useRef<((value: string | boolean) => void) | null>(
    null,
  );
  const validationVersionRef = useRef(0);
  const activeValidationRunRef = useRef(0);
  // Track the last validation result so cancelled promises preserve error state
  const lastResultRef = useRef<string | boolean>(true);

  const startValidation = useCallback(
    (
      value: T,
      resolve: (value: string | boolean) => void,
      validationVersion: number,
    ) => {
      activeValidationRunRef.current += 1;
      const validationRun = activeValidationRunRef.current;

      void (async () => {
        let shouldValidate = true;
        while (shouldValidate) {
          shouldValidate = false;
          const validateFnVersion = validateFnVersionRef.current;
          let result: string | boolean;

          try {
            result = await validateFnRef.current(value);
          } catch {
            result = false;
          }

          if (
            validationVersionRef.current !== validationVersion ||
            currentValueRef.current !== value ||
            pendingResolveRef.current !== resolve ||
            activeValidationRunRef.current !== validationRun
          ) {
            return;
          }

          // Validator context changed while this async call was awaiting, so
          // resolve the pending form validation with a fresh result instead.
          if (validateFnVersionRef.current !== validateFnVersion) {
            shouldValidate = true;
          } else {
            lastResultRef.current = result;
            resolve(result);
            pendingResolveRef.current = null;
            return;
          }
        }
      })();
    },
    [],
  );

  const cancel = useCallback((result = lastResultRef.current) => {
    activeValidationRunRef.current += 1;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingResolveRef.current) {
      pendingResolveRef.current(result);
      pendingResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    const pendingResolve = pendingResolveRef.current;
    if (!pendingResolve || debounceTimerRef.current) {
      return;
    }

    startValidation(
      currentValueRef.current,
      pendingResolve,
      validationVersionRef.current,
    );
  }, [startValidation, validateFn]);

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

        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          startValidation(value, resolve, validationVersion);
        }, delay);
      }),
    [cancel, delay, startValidation],
  );

  return useMemo(() => ({ validate, cancel }), [validate, cancel]);
}
