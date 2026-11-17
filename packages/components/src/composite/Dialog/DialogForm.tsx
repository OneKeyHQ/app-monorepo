import { useContext, useEffect, useMemo } from 'react';

import { Form } from '../../forms/Form';
import { useForm } from '../../hooks/useForm';

import { DialogContext } from './context';

import type { IDialogFormProps } from './type';

export function DialogForm({ formProps, children }: IDialogFormProps) {
  const form = useForm(formProps);
  const { dialogInstance } = useContext(DialogContext);
  // Assign during render so `getForm()` is usable from this commit onwards…
  useMemo(() => {
    if (dialogInstance?.ref) {
      dialogInstance.ref.current = form;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  // …and announce it from an effect, where subscribers may re-render. This
  // module is lazy, so the announcement is how the footer learns the form it
  // watches has appeared or been replaced. (OK-62416)
  useEffect(() => {
    const instance = dialogInstance;
    instance?.registerForm?.(form);
    return () => {
      // Leaving a dead form registered would let the confirm button keep
      // validating and reading the values of a form nobody can type into.
      // Only clear it if it is still ours: a replacement registers itself
      // first when the dialog swaps one `Dialog.Form` for another, and
      // reading the live value at teardown is exactly how we tell the two
      // apart — the usual "snapshot the ref" advice would defeat it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (instance?.ref?.current === form) {
        instance?.registerForm?.(undefined);
      }
    };
  }, [dialogInstance, form]);
  return <Form form={form}>{children}</Form>;
}

export const DialogFormField = Form.Field;

export function preloadDialogForm() {
  const preload = (Form as typeof Form & { preload?: () => Promise<unknown> })
    .preload;
  return preload?.() ?? Promise.resolve();
}
