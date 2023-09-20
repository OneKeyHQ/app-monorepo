import { useEffect, useRef, useState } from 'react';

import { debounce } from 'lodash';

import { useDebounce } from './useDebounce';

import type { UseFormReturn, WatchObserver } from 'react-hook-form';

function useFormOnChangeDebounced<T>({
  useFormReturn,
  wait = 500,
  revalidate = true,
  clearErrorIfEmpty = false,
  clearErrorWhenTextChange = false,
  onChange,
}: {
  // @ts-expect-error
  useFormReturn: UseFormReturn<T, any>;
  wait?: number;
  revalidate?: boolean;
  clearErrorIfEmpty?: boolean;
  clearErrorWhenTextChange?: boolean;
  onChange?: WatchObserver<T>;
}) {
  const { watch, trigger, formState, clearErrors, getValues } = useFormReturn;
  const loadingRef = useRef<boolean>(false);
  const [values, setValues] = useState<T>();

  // fix auto trigger for form defaultValue
  useEffect(() => {
    const v = getValues();
    // @ts-expect-error
    setValues(v);
    setTimeout(() => trigger(), 0);
  }, [getValues, trigger]);

  useEffect(() => {
    const debounceValidate = debounce(
      (formValues, { name, type }) => {
        loadingRef.current = false;
        // type=undefined by setValue()
        if (type === 'change' || type === undefined) {
          setValues(formValues);
          if (onChange) {
            onChange(formValues, { name, type });
          }

          if (clearErrorIfEmpty) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (formValues?.[name] === '') {
              clearErrors(name);
            }
          }

          if (revalidate) {
            // eslint-disable-next-line no-void
            void trigger(name);
          }
        }
      },
      wait,
      { leading: false, trailing: true },
    );
    const subscription = watch((formValues, { name, type }) => {
      loadingRef.current = true;
      if (clearErrorWhenTextChange) {
        clearErrors(name);
      }
      debounceValidate(formValues, { name, type });
    });
    return () => subscription.unsubscribe();
  }, [
    clearErrorIfEmpty,
    clearErrorWhenTextChange,
    clearErrors,
    onChange,
    revalidate,
    trigger,
    wait,
    watch,
  ]);

  const isValid = useDebounce(
    formState.isValid &&
      !Object.keys(formState.errors).length &&
      !formState.isValidating,
    100,
  );

  return {
    loadingRef,
    isLoading: loadingRef.current,
    formValues: values,
    isValid,
  };
}
export { useFormOnChangeDebounced };
