import { useEffect } from 'react';

import { debounce } from 'lodash';
import { UseFormReturn, WatchObserver } from 'react-hook-form';

function useFormOnChangeDebounced<T>({
  useFormReturn,
  wait = 500,
  revalidate = true,
  onChange,
}: {
  useFormReturn: UseFormReturn<T, any>;
  wait?: number;
  revalidate?: boolean;
  onChange?: WatchObserver<T>;
}) {
  const { watch, trigger } = useFormReturn;

  useEffect(() => {
    const debounceValidate = debounce(
      (formValues, { name, type }) => {
        if (type === 'change') {
          if (onChange) {
            onChange(formValues, { name, type });
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
      debounceValidate(formValues, { name, type });
    });
    return () => subscription.unsubscribe();
  }, [onChange, revalidate, trigger, wait, watch]);
}
export { useFormOnChangeDebounced };
