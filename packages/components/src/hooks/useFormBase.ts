import { useMemo, useRef } from 'react';

import { useForm as useFromFunc } from 'react-hook-form';

import type { FieldValues, UseFormProps, UseFormReturn } from 'react-hook-form';

export type IFormMode =
  | 'onBlur'
  | 'onChange'
  | 'onSubmit'
  | 'onTouched'
  | 'all';

export type IReValidateMode = 'onSubmit' | 'onBlur' | 'onChange' | undefined;

export const useForm = <
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues extends FieldValues | undefined = undefined,
>(
  props?: UseFormProps<TFieldValues, TContext> & {
    onSubmit?: (
      data: UseFormReturn<TFieldValues, TContext, TTransformedValues>,
    ) => void;
    mode?: IFormMode;
  },
): UseFormReturn<TFieldValues, TContext, TTransformedValues> & {
  submit?: () => Promise<void>;
} => {
  const form = useFromFunc({
    ...props,
    mode: props?.mode || 'onBlur',
  });
  const formRef = useRef(form);
  formRef.current = form;
  const onSubmitRef = useRef<
    | ((
        formContext: UseFormReturn<TFieldValues, TContext, TTransformedValues>,
      ) => void)
    | null
  >(null);
  onSubmitRef.current = props?.onSubmit ?? null;
  const handleSubmit = useMemo(() => {
    if (onSubmitRef.current) {
      const callback = () => {
        onSubmitRef.current?.(formRef.current as any);
      };
      const handler = async () => {
        const submit = formRef.current.handleSubmit(callback);
        await submit();
      };
      return handler;
    }
    return undefined;
  }, []);

  // To avoid reassigning the submit method on every re-render, only update when handleSubmit changes
  // Since handleSubmit is cached via useMemo, this won't cause extra re-renders
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (form as any).submit = handleSubmit;

  // 返回带有 submit 方法的表单实例
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return form as any;
};
export {
  useFormContext,
  useFormState,
  useWatch as useFormWatch,
} from 'react-hook-form';

export type {
  FieldValues,
  UseFormProps,
  UseFormReturn,
  FieldErrors,
  FieldError,
  FieldPath,
  FieldPathValue,
} from 'react-hook-form';
