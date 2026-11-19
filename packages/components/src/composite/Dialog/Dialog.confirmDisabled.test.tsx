/**
 * @jest-environment jsdom
 */
/* eslint-disable react-perf/jsx-no-new-object-as-prop, react/jsx-no-constructed-context-values, react-perf/jsx-no-new-function-as-prop */

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { act, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { DialogContext } from './context';
import { Footer } from './Footer';

import type { IDialogContextType, IDialogFooterProps } from './type';
import type { UseFormReturn } from 'react-hook-form';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { dialog: { dialogConfirm: jest.fn() } } },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../primitives', () => ({
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    disabled,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    testID?: string;
  }) => (
    <button type="button" disabled={disabled} data-testid={testID}>
      {children}
    </button>
  ),
}));

type IResetForm = UseFormReturn<{ text: string }>;

type IHarnessState = { mounted: boolean; formKey: number };

type ISubscriptionSpy = { unsubscribe: jest.Mock };

type IHarnessController = {
  setState?: (updater: (state: IHarnessState) => IHarnessState) => void;
  latestForm?: IResetForm;
  registerForm: (form: IResetForm) => void;
  subscriptions: Map<IResetForm, ISubscriptionSpy[]>;
};

const confirmButtonProps: IDialogFooterProps['confirmButtonProps'] = {
  testID: 'confirm',
  disabledOn: ({ getForm }) => {
    const values = getForm()?.getValues() as { text?: string } | undefined;
    return values?.text !== 'RESET';
  },
};

/**
 * Stands in for the lazily loaded `Dialog.Form`: it only exists once the
 * harness mounts it, and it announces itself through the same `registerForm`
 * channel the real one uses.
 */
function LateForm({ controller }: { controller: IHarnessController }) {
  const form = useForm<{ text: string }>({ defaultValues: { text: '' } });
  // Make the footer's subscription observable, so teardown can be asserted
  // rather than inferred. Patch during render: the footer subscribes from an
  // effect that runs after `registerForm` below.
  useMemo(() => {
    const spies: ISubscriptionSpy[] = [];
    controller.subscriptions.set(form, spies);
    const originalWatch = form.watch.bind(form) as (
      ...args: unknown[]
    ) => unknown;
    form.watch = ((...args: unknown[]) => {
      const result = originalWatch(...args) as
        | { unsubscribe?: () => void }
        | undefined;
      if (typeof result?.unsubscribe !== 'function') {
        return result;
      }
      const spy: ISubscriptionSpy = {
        unsubscribe: jest.fn(result.unsubscribe.bind(result)),
      };
      spies.push(spy);
      return spy;
    }) as IResetForm['watch'];
  }, [controller, form]);
  useEffect(() => {
    controller.latestForm = form;
    controller.registerForm(form);
  }, [controller, form]);
  return null;
}

function Harness({
  controller,
  contextValue,
}: {
  controller: IHarnessController;
  contextValue: IDialogContextType;
}) {
  const [state, setState] = useState<IHarnessState>({
    mounted: false,
    formKey: 0,
  });
  controller.setState = setState;
  return (
    <DialogContext.Provider value={contextValue}>
      {state.mounted ? (
        <LateForm key={state.formKey} controller={controller} />
      ) : null}
      <Footer
        showFooter
        showConfirmButton
        showCancelButton={false}
        onConfirmText="confirm"
        confirmButtonProps={confirmButtonProps}
      />
    </DialogContext.Provider>
  );
}

function renderFooter() {
  const formRef: { current: IResetForm | undefined } = { current: undefined };
  const listeners = new Set<() => void>();
  const controller: IHarnessController = {
    subscriptions: new Map<IResetForm, ISubscriptionSpy[]>(),
    registerForm: (form: IResetForm) => {
      formRef.current = form;
      for (const listener of listeners) {
        listener();
      }
    },
  };
  const contextValue = {
    dialogInstance: {
      close: jest.fn(),
      ref: formRef,
      isExist: () => true,
      registerForm: controller.registerForm,
      subscribeFormChange: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    footerRef: { notifyUpdate: undefined, props: undefined },
  } as unknown as IDialogContextType;

  const { unmount } = render(
    <Harness controller={controller} contextValue={contextValue} />,
  );

  return {
    confirmButton: () => screen.getByTestId('confirm') as HTMLButtonElement,
    mountForm: () =>
      act(() => {
        controller.setState?.((s) => ({ ...s, mounted: true }));
      }),
    remountForm: () =>
      act(() => {
        controller.setState?.((s) => ({ ...s, formKey: s.formKey + 1 }));
      }),
    getForm: () => controller.latestForm as IResetForm,
    subscriptionsOf: (form: IResetForm) =>
      controller.subscriptions.get(form) ?? [],
    formChangeListenerCount: () => listeners.size,
    unmount,
  };
}

describe('Dialog footer confirm button', () => {
  it('follows a form that registers after the footer mounted', () => {
    const { confirmButton, mountForm, getForm } = renderFooter();
    expect(confirmButton().disabled).toBe(true);

    mountForm();
    expect(confirmButton().disabled).toBe(true);

    act(() => {
      getForm().setValue('text', 'RESET');
    });
    expect(confirmButton().disabled).toBe(false);
  });

  it('follows the replacement when the form remounts', () => {
    const { confirmButton, mountForm, remountForm, getForm } = renderFooter();
    mountForm();
    const firstForm = getForm();

    remountForm();
    const secondForm = getForm();
    expect(secondForm).not.toBe(firstForm);

    // The instance the footer first saw must no longer drive the button…
    act(() => {
      firstForm.setValue('text', 'RESET');
    });
    expect(confirmButton().disabled).toBe(true);

    // …and the one the dialog actually renders must.
    act(() => {
      secondForm.setValue('text', 'RESET');
    });
    expect(confirmButton().disabled).toBe(false);
  });

  it('drops the replaced form’s subscription instead of leaking it', () => {
    const { mountForm, remountForm, getForm, subscriptionsOf } = renderFooter();
    mountForm();
    const firstForm = getForm();
    expect(subscriptionsOf(firstForm)).toHaveLength(1);

    remountForm();

    expect(subscriptionsOf(firstForm)[0].unsubscribe).toHaveBeenCalled();
    expect(getForm()).not.toBe(firstForm);
    expect(subscriptionsOf(getForm())).toHaveLength(1);
    expect(subscriptionsOf(getForm())[0].unsubscribe).not.toHaveBeenCalled();
  });

  it('drops its subscriptions when the footer unmounts', () => {
    const {
      mountForm,
      getForm,
      subscriptionsOf,
      formChangeListenerCount,
      unmount,
    } = renderFooter();
    mountForm();
    const form = getForm();
    expect(formChangeListenerCount()).toBe(1);

    unmount();

    expect(subscriptionsOf(form)[0].unsubscribe).toHaveBeenCalled();
    expect(formChangeListenerCount()).toBe(0);
  });

  it('re-disables the button when the value stops matching', () => {
    const { confirmButton, mountForm, getForm } = renderFooter();
    mountForm();

    act(() => {
      getForm().setValue('text', 'RESET');
    });
    expect(confirmButton().disabled).toBe(false);

    act(() => {
      getForm().setValue('text', 'RESE');
    });
    expect(confirmButton().disabled).toBe(true);
  });
});
