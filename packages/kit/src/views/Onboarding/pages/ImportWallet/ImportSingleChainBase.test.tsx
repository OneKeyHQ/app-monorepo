/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';
import { cloneElement } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useController } from 'react-hook-form';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ImportSingleChainBase } from './ImportSingleChainBase';

import type { UseFormReturn } from 'react-hook-form';

const mockValidateInput = jest.fn(async ({ input }: { input: string }) => ({
  isValid: input === 'valid-test-input',
}));
const mockCheckAccountName = jest.fn(async ({ name }: { name: string }) => {
  if (name === 'taken') {
    throw new OneKeyLocalError('Duplicate account name');
  }
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const { TextInput } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const { useForm, useFormWatch } = jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useFormBase')
  >('../../../../../../components/src/hooks/useFormBase');

  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Field = ({
    name,
    children,
  }: {
    name: string;
    children: ReactElement<{
      value?: string;
      onChangeText?: (text: string) => void;
    }>;
  }) => {
    const { field } = useController({ name });
    return cloneElement(children, {
      value: field.value as string,
      onChangeText: field.onChange,
    });
  };
  const Form = ({
    form,
    children,
  }: {
    form: UseFormReturn & { submit?: () => Promise<void> };
    children?: ReactNode;
  }) => (
    <FormProvider {...form}>
      <form
        data-testid="import-form"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit?.();
        }}
      >
        {children}
      </form>
    </FormProvider>
  );

  return {
    Form: Object.assign(Form, { Field }),
    Input: TextInput,
    Page: Object.assign(Wrapper, {
      Header: () => null,
      Body: Wrapper,
      Footer: ({
        onConfirm,
        confirmButtonProps,
      }: {
        onConfirm: () => void;
        confirmButtonProps: { disabled: boolean };
      }) => (
        <button
          type="button"
          disabled={confirmButtonProps.disabled}
          onClick={onConfirm}
        >
          Confirm
        </button>
      ),
    }),
    SizableText: Wrapper,
    useClipboard: () => ({}),
    useMedia: () => ({}),
    useForm,
    useFormWatch,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      encodeSensitiveText: async ({ text }: { text: string }) => text,
    },
    serviceAccount: {
      ensureAccountNameNotDuplicate: (params: { name: string }) =>
        mockCheckAccountName(params),
      validateGeneralInputOfImporting: (params: { input: string }) =>
        mockValidateInput(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  ControlledNetworkSelectorTrigger: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger',
  () => ({
    DeriveTypeSelectorFormInput: () => null,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({
    useAccountSelectorTrigger: () => ({ activeAccount: {} }),
  }),
);
jest.mock('@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCodeLazy', () => ({
  __esModule: true,
  default: () => ({}),
}));

function renderImport(onConfirm: () => Promise<void>) {
  render(
    <ImportSingleChainBase
      validationParams={{ input: '', validatePrivateKey: true }}
      title="Import private key"
      inputLabel="Private key"
      inputPlaceholder="Enter private key"
      inputIsSecure
      inputTestID="private-key"
      invalidMessage="Invalid private key"
      onConfirm={onConfirm}
    />,
  );
  return screen.getByTestId('private-key');
}

async function finishValidation() {
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
}

describe('private key import submission', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('submits on Enter once while the import is in progress', async () => {
    let finishImport: (() => void) | undefined;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishImport = resolve;
        }),
    );
    const input = renderImport(onConfirm);
    fireEvent.change(input, { target: { value: 'valid-test-input' } });
    await finishValidation();

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.submit(screen.getByTestId('import-form'));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => finishImport?.());
  });

  it('blocks Enter and form submission for stale or invalid values and duplicate names', async () => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    const footer = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Confirm',
    });
    const pressEnter = () => fireEvent.keyDown(input, { key: 'Enter' });

    pressEnter();
    fireEvent.change(input, { target: { value: 'valid-test-input' } });
    pressEnter();
    await finishValidation();
    expect(footer.disabled).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'invalid-test-input' } });
    pressEnter();
    fireEvent.submit(screen.getByTestId('import-form'));
    await finishValidation();
    pressEnter();
    expect(footer.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'valid-test-input' } });
    fireEvent.change(screen.getByTestId('onboarding-input'), {
      target: { value: 'taken' },
    });
    await finishValidation();
    pressEnter();
    expect(footer.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('onboarding-input'), {
      target: { value: 'available' },
    });
    await finishValidation();
    expect(footer.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(footer);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
