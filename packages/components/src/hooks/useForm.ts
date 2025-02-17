import { useMemo } from 'react';

import { useForm as useFromFunc } from 'react-hook-form';

import type { FieldValues, UseFormProps, UseFormReturn } from 'react-hook-form';

export const useForm = <
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues extends FieldValues | undefined = undefined,
>(
  props?: UseFormProps<TFieldValues, TContext> & {
    onSubmit?: (
      data: UseFormReturn<TFieldValues, TContext, TTransformedValues>,
    ) => void;
    mode?: 'onBlur' | 'onChange' | 'onSubmit' | 'onTouched' | 'all';
  },
): UseFormReturn<TFieldValues, TContext, TTransformedValues> & {
  submit?: () => Promise<void>;
} => {
  const form = useFromFunc({
    ...props,
    mode: props?.mode || 'onBlur',
  });
  const handleSubmit = useMemo(() => {
    if (props?.onSubmit) {
      const callback = () => props.onSubmit?.(form as any);
      const handler = form.handleSubmit(callback);
      return handler;
    }
    return undefined;
  }, [props, form]);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return useMemo(
    () =>
      props?.onSubmit
        ? {
            ...form,
            submit: handleSubmit,
          }
        : form,
    [form, handleSubmit, props?.onSubmit],
  ) as any;
};
export {
  useFormContext,
  useFormState,
  useWatch as useFormWatch,
} from 'react-hook-form';

export type * from 'react-hook-form';
