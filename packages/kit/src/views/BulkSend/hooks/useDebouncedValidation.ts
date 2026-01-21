import { useCallback, useRef } from 'react';

export function useDebouncedValidation<T extends string>(
  validateFn: (value: T) => Promise<string | boolean>,
  delay = 300,
) {
  const currentValueRef = useRef<T>('' as T);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (value: T): Promise<string | boolean> =>
      new Promise((resolve) => {
        currentValueRef.current = value;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        debounceTimerRef.current = setTimeout(async () => {
          const result = await validateFn(value);
          if (currentValueRef.current === value) {
            resolve(result);
          }
        }, delay);
      }),
    [validateFn, delay],
  );
}
