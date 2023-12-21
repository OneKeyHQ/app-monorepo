import { useContext, useMemo } from 'react';

import { useForm } from 'react-hook-form';

import { Form } from '../../forms/Form';

import { DialogContext } from './context';

import type { IDialogFormProps } from './type';

export function DialogForm({
  formProps,
  children,
  ...props
}: IDialogFormProps) {
  const form = useForm(formProps);
  const { dialogInstance } = useContext(DialogContext);
  useMemo(() => {
    if (dialogInstance?.ref) {
      dialogInstance.ref.current = form;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  return (
    <Form form={form} {...props}>
      {children}
    </Form>
  );
}
