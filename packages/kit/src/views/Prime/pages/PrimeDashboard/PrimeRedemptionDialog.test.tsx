/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPrimeRedemptionParams,
  IPrimeRedemptionResult,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { PrimeTestIDs } from '../../testIDs';

import { showPrimeRedemptionDialog } from './PrimeRedemptionDialog';

type IDialogConfig = {
  renderContent?: ReactNode;
};

type IDialogMockInstance = {
  close: jest.Mock<Promise<void>, []>;
  getForm: () => undefined;
  isExist: () => boolean;
};

const mockDialogShow = jest.fn<IDialogMockInstance, [IDialogConfig]>();
const mockRedeemPrimeCode = jest.fn<
  Promise<IPrimeRedemptionResult>,
  [IPrimeRedemptionParams]
>();
const mockFetchPrimeUserInfo = jest.fn<
  Promise<unknown>,
  [{ forceRefresh?: boolean }?]
>();
const mockDialogFooterClose = jest.fn<Promise<void>, []>();
let mockThemeName: 'dark' | 'light' = 'light';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: { count?: number; date?: string },
    ) => {
      if (values?.count !== undefined) {
        return `${id}:${String(values.count)}`;
      }
      if (values?.date !== undefined) {
        return `${id}:${values.date}`;
      }
      return id;
    },
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Controller, FormProvider } = jest.requireActual(
    'react-hook-form',
  ) as typeof import('react-hook-form');

  function Container({
    accessibilityLabel,
    accessibilityLiveRegion,
    children,
    testID,
  }: {
    accessibilityLabel?: string;
    accessibilityLiveRegion?: 'assertive' | 'none' | 'polite';
    children?: ReactNode;
    testID?: string;
  }) {
    return React.createElement(
      'div',
      {
        'aria-label': accessibilityLabel,
        'aria-live': accessibilityLiveRegion,
        'data-testid': testID,
      },
      children,
    );
  }

  function Form({
    children,
    form,
  }: {
    children?: ReactNode;
    form: import('react-hook-form').UseFormReturn;
  }) {
    return <FormProvider {...form}>{children}</FormProvider>;
  }
  Form.Field = ({
    children,
    name,
  }: {
    children: ReactElement<{
      onChangeText?: (value: string) => void;
      value?: string;
    }>;
    name: string;
  }) =>
    React.createElement(Controller, {
      name,
      render: ({ field, fieldState }) =>
        React.createElement(
          React.Fragment,
          null,
          React.cloneElement(children, {
            onChangeText: field.onChange,
            value: field.value,
          }),
          fieldState.error?.message
            ? React.createElement('span', null, fieldState.error.message)
            : null,
        ),
    });

  return {
    Dialog: {
      Footer: ({
        confirmButtonProps,
        onConfirm,
        onConfirmText,
      }: {
        confirmButtonProps?: { disabled?: boolean };
        onConfirm?: (args: {
          close: () => Promise<void>;
          getForm: () => undefined;
          isExist: () => boolean;
          preventClose: () => void;
        }) => Promise<void> | void;
        onConfirmText?: string;
      }) =>
        React.createElement(
          'button',
          {
            disabled: confirmButtonProps?.disabled,
            onClick: () =>
              onConfirm?.({
                close: mockDialogFooterClose,
                getForm: () => undefined,
                isExist: () => true,
                preventClose: jest.fn(),
              }),
            type: 'button',
          },
          onConfirmText,
        ),
      show: (config: IDialogConfig) => mockDialogShow(config),
    },
    Form,
    Icon: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon-name': name }),
    Input: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      testID,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      testID?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        'data-testid': testID,
        onChange: (event: import('react').ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        value,
      }),
    LottieView: () =>
      React.createElement('span', { 'data-testid': 'success-lottie' }),
    SizableText: Container,
    Stack: Container,
    useThemeName: () => mockThemeName,
    useForm: jest.requireActual('react-hook-form').useForm,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiFetchPrimeUserInfo: (params?: { forceRefresh?: boolean }) =>
        mockFetchPrimeUserInfo(params),
      apiRedeemPrimeCode: (params: IPrimeRedemptionParams) =>
        mockRedeemPrimeCode(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatDateFns: (date: Date) => `formatted:${String(date.getTime())}`,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderDialog() {
  showPrimeRedemptionDialog({ expectedOneKeyUserId: 'user-a' });
  const config = mockDialogShow.mock.calls.at(-1)?.[0] as IDialogConfig;
  return render(config.renderContent as ReactElement);
}

describe('PrimeRedemptionDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockThemeName = 'light';
    mockDialogShow.mockReturnValue({
      close: jest.fn(async () => undefined),
      getForm: () => undefined,
      isExist: () => true,
    });
    mockFetchPrimeUserInfo.mockResolvedValue(undefined);
    mockDialogFooterClose.mockResolvedValue(undefined);
  });

  it('keeps submission disabled for an empty code', () => {
    renderDialog();

    expect(
      screen.getByRole('textbox', {
        name: ETranslations.redemption_enter_code_placeholder,
      }),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-icon-name="OnekeyPrimeLightColored"]'),
    ).toBeTruthy();
    const confirmButton = screen.getByRole('button', {
      name: ETranslations.redemption_redeem_button,
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId(PrimeTestIDs.redemptionCodeInput), {
      target: { value: '   ' },
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    expect(mockRedeemPrimeCode).not.toHaveBeenCalled();
  });

  it('uses the Prime icon for the active theme', () => {
    mockThemeName = 'dark';
    renderDialog();

    expect(
      document.querySelector('[data-icon-name="OnekeyPrimeDarkColored"]'),
    ).toBeTruthy();
  });

  it('blocks duplicate submissions while a redemption is in flight', async () => {
    const deferred = createDeferred<{
      addedDays: number;
      finalExpiresAt: number;
    }>();
    mockRedeemPrimeCode.mockReturnValue(deferred.promise);
    renderDialog();
    fireEvent.change(screen.getByTestId(PrimeTestIDs.redemptionCodeInput), {
      target: { value: '  OKP-PJ37L-DYXWR  ' },
    });
    const confirmButton = screen.getByRole('button', {
      name: ETranslations.redemption_redeem_button,
    });

    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(mockRedeemPrimeCode).toHaveBeenCalledTimes(1);
    expect(mockRedeemPrimeCode).toHaveBeenCalledWith({
      code: 'OKP-PJ37L-DYXWR',
      expectedOneKeyUserId: 'user-a',
    });

    await act(async () => {
      deferred.resolve({
        addedDays: 30,
        finalExpiresAt: 1_800_000_000_000,
      });
      await deferred.promise;
    });
  });

  it('shows the success result and refreshes Prime state best-effort', async () => {
    mockRedeemPrimeCode.mockResolvedValue({
      addedDays: 30,
      finalExpiresAt: 1_800_000_000_000,
    });
    mockFetchPrimeUserInfo.mockRejectedValue(new Error('refresh failed'));
    renderDialog();
    fireEvent.change(screen.getByTestId(PrimeTestIDs.redemptionCodeInput), {
      target: { value: 'OKP-PJ37L-DYXWR' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: ETranslations.redemption_redeem_button,
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId(PrimeTestIDs.redemptionSuccess)).toBeTruthy();
    });
    expect(
      screen.getByText(
        `${ETranslations.prime_redemption_received_days__msg}:30`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `${ETranslations.prime_membership_valid_until__desc}:formatted:1800000000000`,
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByLabelText(
          `${ETranslations.redemption_success_title} ${ETranslations.prime_redemption_received_days__msg}:30 ${ETranslations.prime_membership_valid_until__desc}:formatted:1800000000000`,
        )
        .getAttribute('aria-live'),
    ).toBe('polite');
    expect(screen.getByTestId('success-lottie')).toBeTruthy();
    expect(
      document.querySelector('[data-icon-name="OnekeyPrimeLightColored"]'),
    ).toBeTruthy();
    expect(mockFetchPrimeUserInfo).toHaveBeenCalledWith({
      forceRefresh: true,
    });
  });

  it('shows the localized server error inline and allows retry', async () => {
    const serverMessage = '当前订阅不支持兑换；不会影响订阅扣款日期';
    mockRedeemPrimeCode.mockRejectedValueOnce({
      code: 90_506,
      data: {
        code: 90_506,
        message: serverMessage,
        messageId: 'error__prime_redemption_code_unlimited_entitlement',
      },
      message: serverMessage,
    });
    renderDialog();
    fireEvent.change(screen.getByTestId(PrimeTestIDs.redemptionCodeInput), {
      target: { value: 'OKP-PJ37L-DYXWR' },
    });
    const confirmButton = screen.getByRole('button', {
      name: ETranslations.redemption_redeem_button,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(serverMessage)).toBeTruthy();
    });
    expect(
      (screen.getByTestId(PrimeTestIDs.redemptionCodeInput) as HTMLInputElement)
        .value,
    ).toBe('OKP-PJ37L-DYXWR');

    mockRedeemPrimeCode.mockResolvedValueOnce({
      addedDays: 30,
      finalExpiresAt: 1_800_000_000_000,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByTestId(PrimeTestIDs.redemptionSuccess)).toBeTruthy();
    });
    expect(mockRedeemPrimeCode).toHaveBeenCalledTimes(2);
  });

  it('closes for an expired OneKey ID session without duplicating the toast inline', async () => {
    const message = '用户认证失败，请重试登录。';
    mockRedeemPrimeCode.mockRejectedValue({
      key: ETranslations.id_login_expired_description,
      message,
    });
    renderDialog();
    fireEvent.change(screen.getByTestId(PrimeTestIDs.redemptionCodeInput), {
      target: { value: 'OKP-PJ37L-DYXWR' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: ETranslations.redemption_redeem_button,
      }),
    );

    await waitFor(() => {
      expect(mockDialogFooterClose).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(message)).toBeNull();
  });
});
