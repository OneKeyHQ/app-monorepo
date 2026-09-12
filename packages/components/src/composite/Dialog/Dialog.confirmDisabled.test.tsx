/**
 * @jest-environment jsdom
 */
/* eslint-disable react-perf/jsx-no-new-object-as-prop, react/jsx-no-constructed-context-values */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { DialogContext } from './context';
import { Footer } from './Footer';

import type { IDialogContextType, IDialogFooterProps } from './type';

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

// Stands in for the react-hook-form instance `Dialog.Form` registers: only the
// two members `disabledOn` and the footer subscription actually touch.
function createFakeForm(initialText = '') {
  const listeners = new Set<() => void>();
  let text = initialText;
  return {
    getValues: () => ({ text }),
    setText(next: string) {
      text = next;
      for (const listener of listeners) {
        listener();
      }
    },
    watch(listener: () => void) {
      listeners.add(listener);
      return {
        unsubscribe: () => {
          listeners.delete(listener);
        },
      };
    },
    listenerCount: () => listeners.size,
  };
}

type IFakeForm = ReturnType<typeof createFakeForm>;

const confirmButtonProps: IDialogFooterProps['confirmButtonProps'] = {
  testID: 'confirm',
  disabledOn: ({ getForm }) => {
    const values = getForm()?.getValues() as { text?: string } | undefined;
    return values?.text !== 'RESET';
  },
};

function renderFooter() {
  const formRef: { current: IFakeForm | undefined } = { current: undefined };
  const contextValue = {
    dialogInstance: {
      close: jest.fn(),
      ref: formRef,
      isExist: () => true,
    },
    footerRef: { notifyUpdate: undefined, props: undefined },
  } as unknown as IDialogContextType;
  const { unmount } = render(
    <DialogContext.Provider value={contextValue}>
      <Footer
        showFooter
        showConfirmButton
        showCancelButton={false}
        onConfirmText="confirm"
        confirmButtonProps={confirmButtonProps}
      />
    </DialogContext.Provider>,
  );
  const confirmButton = () =>
    screen.getByTestId('confirm') as HTMLButtonElement;
  return { formRef, confirmButton, unmount };
}

describe('Dialog footer confirm button', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('picks up a form registered after the footer mounted', () => {
    const { formRef, confirmButton } = renderFooter();
    expect(confirmButton().disabled).toBe(true);

    // `Dialog.Form` is lazy — it can only register once its module resolved.
    const form = createFakeForm('RESET');
    act(() => {
      formRef.current = form;
      jest.advanceTimersByTime(200);
    });

    expect(confirmButton().disabled).toBe(false);
  });

  it('follows the form when the dialog registers a new instance', () => {
    const { formRef, confirmButton } = renderFooter();
    const firstForm = createFakeForm();
    act(() => {
      formRef.current = firstForm;
      jest.advanceTimersByTime(200);
    });
    expect(confirmButton().disabled).toBe(true);

    // The lazy form remounts while the dialog opens, replacing the instance the
    // footer had already subscribed to (OK-62416).
    const secondForm = createFakeForm();
    act(() => {
      formRef.current = secondForm;
      jest.advanceTimersByTime(200);
    });
    expect(firstForm.listenerCount()).toBe(0);

    act(() => {
      secondForm.setText('RESET');
    });
    expect(confirmButton().disabled).toBe(false);
  });

  it('drops its subscription when the footer unmounts', () => {
    const { formRef, unmount } = renderFooter();
    const form = createFakeForm();
    act(() => {
      formRef.current = form;
      jest.advanceTimersByTime(200);
    });
    expect(form.listenerCount()).toBe(1);

    act(() => {
      unmount();
    });
    expect(form.listenerCount()).toBe(0);
  });
});
