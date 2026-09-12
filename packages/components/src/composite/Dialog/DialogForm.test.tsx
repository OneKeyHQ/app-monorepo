/**
 * @jest-environment jsdom
 */
/* eslint-disable react/jsx-no-constructed-context-values, react-perf/jsx-no-new-object-as-prop */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { DialogContext } from './context';
import { DialogForm } from './DialogForm';

import type { IDialogContextType, IDialogForm } from './type';

jest.mock('../../forms/Form', () => {
  const FormMock = ({ children }: { children?: ReactNode }) => <>{children}</>;
  FormMock.Field = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return { Form: FormMock };
});

jest.mock('../../hooks/useForm', () => ({
  useForm: jest.requireActual('react-hook-form').useForm,
}));

function renderDialogForm() {
  const formRef: { current: IDialogForm | undefined } = { current: undefined };
  const registered: (IDialogForm | undefined)[] = [];
  const contextValue = {
    dialogInstance: {
      close: jest.fn(),
      ref: formRef,
      isExist: () => true,
      registerForm: (form: IDialogForm | undefined) => {
        registered.push(form);
        formRef.current = form;
      },
      subscribeFormChange: () => () => {},
    },
    footerRef: { notifyUpdate: undefined, props: undefined },
  } as unknown as IDialogContextType;

  const { unmount, rerender } = render(
    <DialogContext.Provider value={contextValue}>
      <DialogForm formProps={{ defaultValues: { text: '' } }}>
        <div />
      </DialogForm>
    </DialogContext.Provider>,
  );

  return { formRef, registered, unmount, rerender, contextValue };
}

describe('DialogForm registration', () => {
  it('announces its form to the dialog instance', () => {
    const { formRef, registered } = renderDialogForm();

    expect(registered).toHaveLength(1);
    expect(formRef.current).toBeDefined();
    expect(typeof formRef.current?.getValues).toBe('function');
  });

  it('clears the registration when it unmounts', () => {
    const { formRef, registered, unmount } = renderDialogForm();
    const form = formRef.current;

    unmount();

    // A dialog whose form is gone must not keep validating and reading the
    // values of a form nobody can type into.
    expect(registered).toEqual([form, undefined]);
    expect(formRef.current).toBeUndefined();
  });

  it('leaves a newer registration alone when the old form tears down', () => {
    const { formRef, contextValue, rerender } = renderDialogForm();
    const replacement = { getValues: () => ({}) } as unknown as IDialogForm;

    // Stand in for a replacement that registered before the outgoing
    // instance's cleanup ran: the stale teardown must not wipe it.
    contextValue.dialogInstance.registerForm?.(replacement);
    rerender(
      <DialogContext.Provider value={contextValue}>
        <div />
      </DialogContext.Provider>,
    );

    expect(formRef.current).toBe(replacement);
  });
});
