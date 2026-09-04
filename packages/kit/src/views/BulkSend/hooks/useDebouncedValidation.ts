import { useCallback, useEffect, useMemo, useRef } from 'react';

type IValidationResult = string | boolean;

type IDebouncedValidation<T extends string> = {
  validate: (value: T) => Promise<IValidationResult>;
  // Settles every pending caller with `result` (a value or the promise of a
  // validation that replaces the debounced one); defaults to the last
  // completed result.
  cancel: (result?: IValidationResult | Promise<IValidationResult>) => void;
};

type IValidationResolve = (value: string | boolean) => void;

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
  // Every `validate()` call that has not been answered yet. A call that is
  // superseded by a newer value stays in this list and settles together with
  // the newest validation, so a react-hook-form pass never receives a result
  // that was computed for a different input value (OK-61587: the empty-value
  // "required" result leaked into the pass that validated the seeded address).
  const pendingResolvesRef = useRef<IValidationResolve[]>([]);
  const validationVersionRef = useRef(0);
  const activeValidationRunRef = useRef(0);
  // Last completed result; only used to settle pending promises when the
  // validator is torn down (unmount / explicit cancel) so the form keeps its
  // last known error state instead of hanging or clearing it with `true`.
  const lastResultRef = useRef<string | boolean>(true);

  const settlePending = useCallback(
    (result: IValidationResult | Promise<IValidationResult>) => {
      const resolves = pendingResolvesRef.current;
      pendingResolvesRef.current = [];
      if (resolves.length === 0) {
        return;
      }
      void Promise.resolve(result).then(
        (settled) => {
          resolves.forEach((resolve) => resolve(settled));
        },
        () => {
          // A replacement validation that rejects must still settle the
          // callers it replaced, or the form stays "validating" and blocks
          // Next. Mirror the in-hook catch: a thrown validator is invalid.
          resolves.forEach((resolve) => resolve(false));
        },
      );
    },
    [],
  );

  const startValidation = useCallback(
    (value: T, validationVersion: number) => {
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
            settlePending(result);
            return;
          }
        }
      })();
    },
    [settlePending],
  );

  const cancel = useCallback(
    (
      result:
        | IValidationResult
        | Promise<IValidationResult> = lastResultRef.current,
    ) => {
      activeValidationRunRef.current += 1;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      settlePending(result);
    },
    [settlePending],
  );

  useEffect(() => {
    if (pendingResolvesRef.current.length === 0 || debounceTimerRef.current) {
      return;
    }

    startValidation(currentValueRef.current, validationVersionRef.current);
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

        // Supersede the previous request without settling it: an in-flight
        // run is abandoned and the debounce restarts, while every earlier
        // caller keeps waiting for the result of this latest value.
        activeValidationRunRef.current += 1;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        pendingResolvesRef.current.push(resolve);

        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          startValidation(value, validationVersion);
        }, delay);
      }),
    [delay, startValidation],
  );

  return useMemo(() => ({ validate, cancel }), [validate, cancel]);
}
