import { useEffect, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { UseFormReturn, WatchObserver } from 'react-hook-form';

import { useDebounce } from './useDebounce';

function useFormOnChangeDebounced<T>({
  useFormReturn,
  wait = 500,
  revalidate = true,
  clearErrorIfEmpty = false,
  onChange,
}: {
  useFormReturn: UseFormReturn<T, any>;
  wait?: number;
  revalidate?: boolean;
  clearErrorIfEmpty?: boolean;
  onChange?: WatchObserver<T>;
}) {
  const { watch, trigger, formState, clearErrors } = useFormReturn;
  const loadingRef = useRef<boolean>(false);
  const [values, setValues] = useState<T>();

  useEffect(() => {
    const debounceValidate = debounce(
      (formValues, { name, type }) => {
        loadingRef.current = false;
        if (type === 'change') {
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
      debounceValidate(formValues, { name, type });
    });
    return () => subscription.unsubscribe();
  }, [onChange, revalidate, trigger, wait, watch]);

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
