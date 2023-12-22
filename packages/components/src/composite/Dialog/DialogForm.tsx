import { useContext, useMemo } from 'react';

import { Form } from '../../forms/Form';
import { useForm } from '../../hooks';

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
