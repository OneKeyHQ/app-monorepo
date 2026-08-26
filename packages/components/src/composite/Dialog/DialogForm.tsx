import { useContext, useMemo } from 'react';

import { Form } from '../../forms/Form';
import { useForm } from '../../hooks/useForm';

import { DialogContext } from './context';

import type { IDialogFormProps } from './type';

export function DialogForm({ formProps, children }: IDialogFormProps) {
  const form = useForm(formProps);
  const { dialogInstance } = useContext(DialogContext);
  useMemo(() => {
    if (dialogInstance?.ref) {
      dialogInstance.ref.current = form;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  return <Form form={form}>{children}</Form>;
}

export const DialogFormField = Form.Field;

export function preloadDialogForm() {
  const preload = (Form as typeof Form & { preload?: () => Promise<unknown> })
    .preload;
  return preload?.() ?? Promise.resolve();
}
