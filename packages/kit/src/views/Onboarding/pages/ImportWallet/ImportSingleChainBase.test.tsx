/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';
import { cloneElement, useEffect } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useController } from 'react-hook-form';

import type {
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { ImportSingleChainBase } from './ImportSingleChainBase';

import type { UseFormReturn } from 'react-hook-form';

const btcDeriveTypes: IAccountDeriveTypes[] = ['BIP86', 'BIP44'];
const btcDeriveItems: IAccountDeriveInfoItems[] = btcDeriveTypes.map(
  (value) => ({
    value,
    label: value,
    description: undefined,
    item: { namePrefix: value, template: value, coinType: '0' },
  }),
);
const btcValidation: IGeneralInputValidation = {
  isValid: true,
  deriveInfoItems: btcDeriveItems.map(({ item }) => item),
};
const mockValidateInput = jest.fn(
  async ({ input }: { input: string }): Promise<IGeneralInputValidation> => ({
    isValid: input === 'valid-test-input',
  }),
);
const mockLoadDeriveItems = jest.fn(async () => btcDeriveItems);
const mockDeriveTypeChange = jest.fn<void, [(value: string) => void]>();
const mockOnBlur = jest.fn<void, [() => void]>();
const mockCheckAccountName = jest.fn(async ({ name }: { name: string }) => {
  if (name === 'taken') {
    throw new OneKeyLocalError('Duplicate account name');
  }
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@react-navigation/core', () => ({
  useFocusEffect: (effect: () => () => void) => {
    useEffect(() => {
      const cleanup = effect();
      mockOnBlur(cleanup);
      return cleanup;
    }, [effect]);
  },
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
      onChange?: (value: string) => string | { defaultPrevented: true };
      onChangeText?: (text: string) => void;
    }>;
  }) => {
    const { field } = useController({ name });
    const onChangeText = (value: string) => {
      const nextValue = children.props.onChange?.(value) ?? value;
      if (typeof nextValue === 'string') {
        field.onChange(nextValue);
      }
    };
    if (name === 'deriveType') {
      mockDeriveTypeChange(onChangeText);
    }
    return cloneElement(children, {
      value: field.value as string,
      onChangeText,
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
    serviceNetwork: {
      getDeriveInfoItemsOfNetwork: () => mockLoadDeriveItems(),
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
  ControlledNetworkSelectorTrigger: ({
    value,
    onChangeText,
  }: {
    value?: string;
    onChangeText?: (value: string) => void;
  }) => (
    <input
      aria-label="Network"
      value={value ?? ''}
      onChange={(event) => onChangeText?.(event.target.value)}
    />
  ),
}));
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger',
  () => ({
    DeriveTypeSelectorFormInput: ({
      preloadedItems,
      value,
      onChangeText,
    }: {
      preloadedItems?: IAccountDeriveInfoItems[];
      value?: string;
      onChangeText?: (value: string) => void;
    }) => (
      <select
        aria-label="Derivation path"
        value={value ?? ''}
        onChange={(event) => onChangeText?.(event.target.value)}
      >
        <option value="">Choose a derivation path</option>
        {preloadedItems?.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    ),
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
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('remembers Enter during debounce and submits the validated key once', async () => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    fireEvent.change(input, { target: { value: 'valid-test-input' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();

    await finishValidation();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'valid-test-input' }),
      undefined,
    );
  });

  it('cancels a queued Enter when the screen loses focus', async () => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    fireEvent.change(input, { target: { value: 'valid-test-input' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const blur = mockOnBlur.mock.lastCall?.[0];
    expect(blur).toBeDefined();
    act(() => blur?.());
    await finishValidation();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each([
    { field: 'Network', value: 'evm--1' },
    { field: 'onboarding-input', value: 'New name' },
    { field: 'private-key', value: 'replacement-test-input' },
  ])('cancels a queued Enter when $field changes', async ({ field, value }) => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    fireEvent.change(input, { target: { value: 'valid-test-input' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const fieldInput =
      field === 'Network'
        ? screen.getByLabelText(field)
        : screen.getByTestId(field);
    mockValidateInput.mockResolvedValueOnce({ isValid: true });
    fireEvent.change(fieldInput, { target: { value } });
    await finishValidation();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Confirm' })
        .disabled,
    ).toBe(false);

    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
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
    pressEnter();
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

  it('waits for the available BTC derivation types and a selection before confirming', async () => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    const footer = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Confirm',
    });
    const deriveItems = Promise.withResolvers<IAccountDeriveInfoItems[]>();
    mockValidateInput.mockResolvedValueOnce(btcValidation);
    mockLoadDeriveItems.mockReturnValueOnce(deriveItems.promise);

    fireEvent.change(input, { target: { value: 'test-xprv' } });
    await finishValidation();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(footer.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => deriveItems.resolve(btcDeriveItems));
    const selector = screen.getByRole('combobox', { name: 'Derivation path' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(footer.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(selector, { target: { value: 'BIP86' } });
    });
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ deriveType: 'BIP86' }),
      undefined,
    );
  });

  it('keeps a non-default BTC derivation type when editing the name or key whitespace', async () => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    mockValidateInput.mockResolvedValueOnce(btcValidation);
    fireEvent.change(input, { target: { value: 'test-xprv' } });
    await finishValidation();
    const selector = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Derivation path',
    });
    fireEvent.change(selector, { target: { value: 'BIP44' } });

    fireEvent.change(input, { target: { value: '  test-xprv  ' } });
    expect(selector.value).toBe('BIP44');

    const nameCheck = Promise.withResolvers<void>();
    mockCheckAccountName.mockReturnValueOnce(nameCheck.promise);
    fireEvent.change(screen.getByTestId('onboarding-input'), {
      target: { value: 'Renamed account' },
    });
    await finishValidation();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(selector.value).toBe('BIP44');

    await act(async () => nameCheck.resolve());
    expect(selector.value).toBe('BIP44');
    expect(mockValidateInput).toHaveBeenCalledTimes(1);
    expect(mockLoadDeriveItems).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        accountName: 'Renamed account',
        deriveType: 'BIP44',
      }),
      undefined,
    );
  });

  it('discards key validation when the field is cleared, including late results', async () => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    mockValidateInput.mockResolvedValueOnce(btcValidation);
    fireEvent.change(input, { target: { value: 'test-xprv' } });
    await finishValidation();
    expect(
      screen.getByRole('combobox', { name: 'Derivation path' }),
    ).toBeDefined();

    fireEvent.change(input, { target: { value: '' } });
    expect(
      screen.queryByRole('combobox', { name: 'Derivation path' }),
    ).toBeNull();

    const validation = Promise.withResolvers<IGeneralInputValidation>();
    mockValidateInput.mockReturnValueOnce(validation.promise);
    fireEvent.change(input, { target: { value: 'test-xprv' } });
    await finishValidation();
    expect(mockValidateInput).toHaveBeenCalledTimes(2);

    fireEvent.change(input, { target: { value: '' } });
    await act(async () => validation.resolve(btcValidation));
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockLoadDeriveItems).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('combobox', { name: 'Derivation path' }),
    ).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('resets the BTC derivation choice when a cleared key is replaced', async () => {
    const onConfirm = jest.fn(async () => undefined);
    const input = renderImport(onConfirm);
    const footer = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Confirm',
    });
    const getSelector = () =>
      screen.getByRole<HTMLSelectElement>('combobox', {
        name: 'Derivation path',
      });
    mockValidateInput.mockResolvedValueOnce(btcValidation);
    fireEvent.change(input, { target: { value: 'test-xprv-a' } });
    await finishValidation();
    fireEvent.change(getSelector(), { target: { value: 'BIP44' } });
    const delayedChange = mockDeriveTypeChange.mock.lastCall?.[0];
    expect(delayedChange).toBeDefined();

    fireEvent.change(input, { target: { value: '' } });
    mockValidateInput.mockResolvedValueOnce(btcValidation);
    fireEvent.change(input, { target: { value: 'test-xprv-b' } });
    await finishValidation();
    expect(getSelector().value).toBe('');
    act(() => {
      delayedChange?.('BIP44');
    });
    expect(getSelector().value).toBe('');
    expect(footer.disabled).toBe(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(getSelector(), { target: { value: 'BIP86' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'test-xprv-b', deriveType: 'BIP86' }),
      undefined,
    );
  });
});
