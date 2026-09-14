/** @jest-environment jsdom */
import type { ReactElement, ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { createIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { RenameInputWithNameSelector } from '@onekeyhq/kit/src/components/RenameDialog';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showLabelSetDialog } from './HardwareLabelSetDialog';

const mockMessages: Record<string, string> = enMessages;
const mockIntl = createIntl({ locale: 'en-US', messages: mockMessages });

jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isNativeIOS: false },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { FormProvider, useController, useForm, useWatch } =
    jest.requireActual<typeof import('react-hook-form')>('react-hook-form');
  const Text = ({ children }: { children?: ReactNode }) =>
    React.createElement('span', null, children);
  const Form = ({
    children,
    formProps,
  }: {
    children?: ReactNode;
    formProps: { values: { name: string }; mode: 'onChange' };
  }) => {
    const methods = useForm(formProps);
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
  const FormField = ({
    name,
    label,
    labelAddon,
    children,
  }: {
    name: string;
    label: string;
    labelAddon?: ReactNode;
    children: ReactElement<{
      value: string;
      onChange: (value: string) => void;
    }>;
  }) => {
    const { field } = useController({ name });
    return React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { 'data-testid': 'label-row' },
        label,
        labelAddon,
      ),
      React.cloneElement(children, {
        value: field.value,
        onChange: field.onChange,
      }),
    );
  };
  const Input = ({
    value,
    onChangeText,
    testID,
    maxLength,
    keyboardType,
    autoCorrect,
    autoCapitalize,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    testID?: string;
    maxLength?: number;
    keyboardType?: string;
    autoCorrect?: boolean;
    autoCapitalize?: string;
  }) =>
    React.createElement('input', {
      'data-testid': testID,
      'data-keyboard-type': keyboardType,
      'data-auto-correct': autoCorrect,
      'data-auto-capitalize': autoCapitalize,
      value,
      maxLength,
      onChange: (event: { target: { value: string } }) =>
        onChangeText(event.target.value),
    });
  return {
    Dialog: {
      show: jest.fn(() => ({ close: jest.fn() })),
      Form,
      FormField,
      Footer: () => null,
    },
    Form: { FieldDescription: Text },
    Input,
    SizableText: Text,
    Stack: Text,
    Toast: { error: jest.fn() },
    useDialogInstance: () => ({ close: jest.fn() }),
    useFormWatch: (options: { name: 'name' }) =>
      useWatch<{ name: string }>(options),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      getDeviceLabel: jest.fn(async () => 'OneKey Pro 2'),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: false }),
}));

jest.mock(
  '@onekeyhq/kit/src/components/ChangeHistoryDialog/ChangeHistoryDialog',
  () => ({ buildChangeHistoryInputAddon: jest.fn() }),
);

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
}));

async function renderDeviceLabel(deviceType: EDeviceType) {
  const isProtocolV2 =
    deviceType === EDeviceType.Pro2 || deviceType === EDeviceType.Neo;
  await showLabelSetDialog(
    {
      wallet: {
        id: 'hw--test-wallet',
        associatedDeviceInfo: { deviceType },
      } as IDBWallet,
      intl: mockIntl,
      asciiOnly: isProtocolV2,
    },
    {
      maxLength: isProtocolV2 ? 14 : undefined,
      disabledMaxLengthLabel: !isProtocolV2,
      trimOuterWhitespace: isProtocolV2,
      description: isProtocolV2
        ? mockIntl.formatMessage({
            id: ETranslations.hardware_label_allowed_characters__desc,
          })
        : undefined,
      onSubmit: jest.fn(),
    },
  );
  const options = jest.mocked(Dialog.show).mock.calls.at(-1)?.[0];
  return render(<>{options?.renderContent}</>);
}

describe('hardware label form presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNative = false;
    platformEnv.isNativeIOS = false;
  });

  it.each([EDeviceType.Pro2, EDeviceType.Neo])(
    'keeps the %s counter in the label row with only the short helper below',
    async (deviceType) => {
      await renderDeviceLabel(deviceType);

      expect(screen.getByTestId('label-row').textContent).toBe(
        'Device labeling12/14',
      );
      expect(
        screen.getByText('English letters, numbers and symbols'),
      ).toBeTruthy();
      expect(
        screen.queryByText('Do not enter sensitive information.'),
      ).toBeNull();
      expect(screen.queryByText(/ASCII/)).toBeNull();
      expect(screen.getAllByText('12/14')).toHaveLength(1);
    },
  );

  it('updates the label-row counter using the existing normalized value', async () => {
    await renderDeviceLabel(EDeviceType.Pro2);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  12345678901234  ' },
    });
    expect(screen.getByTestId('label-row').textContent).toBe(
      'Device labeling14/14',
    );
  });

  it.each([
    [EDeviceType.Pro2, 'ios', 'ascii-capable', 'false', 'none'],
    [EDeviceType.Neo, 'ios', 'ascii-capable', 'false', 'none'],
    [EDeviceType.Pro2, 'android', null, 'false', 'none'],
    [EDeviceType.Neo, 'android', null, 'false', 'none'],
    [EDeviceType.Pro2, 'desktop', null, null, null],
    [EDeviceType.Neo, 'web', null, null, null],
    [EDeviceType.Pro, 'ios', null, null, null],
    [EDeviceType.Classic1s, 'android', null, null, null],
  ] as const)(
    'keeps the keyboard hints scoped for %s on %s',
    async (deviceType, platform, keyboardType, autoCorrect, autoCapitalize) => {
      platformEnv.isNative = platform === 'ios' || platform === 'android';
      platformEnv.isNativeIOS = platform === 'ios';
      await renderDeviceLabel(deviceType);

      const input = screen.getByRole('textbox');
      expect(input.getAttribute('data-keyboard-type')).toBe(keyboardType);
      expect(input.getAttribute('data-auto-correct')).toBe(autoCorrect);
      expect(input.getAttribute('data-auto-capitalize')).toBe(autoCapitalize);
    },
  );

  it.each([EDeviceType.Pro, EDeviceType.Classic1s])(
    'preserves the existing %s helpers and hidden counter',
    async (deviceType) => {
      await renderDeviceLabel(deviceType);
      expect(screen.getByTestId('label-row').textContent).toBe(
        'Device labeling',
      );
      expect(
        screen.getByText('Do not enter sensitive information.'),
      ).toBeTruthy();
      expect(
        screen.getByText('Labels are applied on your device’s homescreen.'),
      ).toBeTruthy();
      expect(screen.getByRole('textbox').getAttribute('maxlength')).toBe('32');
    },
  );

  it('preserves the default account-rename warning and counter', () => {
    render(
      <RenameInputWithNameSelector
        value="Account"
        maxLength={80}
        disabledMaxLengthLabel={false}
      />,
    );
    expect(
      screen.getByText('Do not enter sensitive information.'),
    ).toBeTruthy();
    expect(screen.getByText('7/80')).toBeTruthy();
  });
});
