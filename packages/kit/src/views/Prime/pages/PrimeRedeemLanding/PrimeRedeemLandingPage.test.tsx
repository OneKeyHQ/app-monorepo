/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPrimeRedemptionParams,
  IPrimeRedemptionResult,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { PrimeTestIDs } from '../../testIDs';

import { PrimeRedeemLandingPage } from './PrimeRedeemLandingPage';

const mockRedeemPrimeCode = jest.fn<
  Promise<IPrimeRedemptionResult>,
  [IPrimeRedemptionParams]
>();
const mockFetchPrimeUserInfo = jest.fn<
  Promise<unknown>,
  [{ forceRefresh?: boolean }?]
>();
const mockLoginOneKeyId = jest.fn<Promise<void>, []>();
const mockPrimeRedemptionResult = jest.fn();
const mockPrimeRedemptionEntryClick = jest.fn();
const mockShowOneKeyIdLoginFailedToast = jest.fn();

let mockRouteParams: { code?: string } | undefined;
let mockIsLoggedIn = false;
const mockUser: {
  displayEmail?: string;
  onekeyUserId?: string;
  primeSubscription?: { isActive: boolean };
} = {
  displayEmail: 'user@example.com',
  onekeyUserId: 'user-a',
};

jest.mock('../../components/oneKeyIdLoginToastUtils', () => ({
  showOneKeyIdLoginFailedToast: (...args: unknown[]) => {
    mockShowOneKeyIdLoginFailedToast(...args);
  },
}));

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

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    effect();
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isLoggedIn: mockIsLoggedIn,
    loginOneKeyId: mockLoginOneKeyId,
    user: mockUser,
  }),
}));

jest.mock('@onekeyhq/kit/src/views/Onboardingv2/components/Layout', () => ({
  LayoutHeaderLanguageSelector: () => null,
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
    description,
    name,
  }: {
    children: ReactElement<{
      onChangeText?: (value: string) => void;
      value?: string;
    }>;
    description?: ReactNode;
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
          description,
        ),
    });

  function UnOrderedList({ children }: { children?: ReactNode }) {
    return React.createElement('ul', null, children);
  }
  UnOrderedList.Item = ({ children }: { children?: ReactNode }) =>
    React.createElement('li', null, children);

  function Page({ children }: { children?: ReactNode }) {
    return React.createElement('div', null, children);
  }
  Page.Body = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);

  return {
    Button: ({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          disabled,
          onClick: onPress,
          type: 'button',
        },
        children,
      ),
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
    Page,
    SizableText: Container,
    Stack: Container,
    Theme: ({ children }: { children?: ReactNode }) => children,
    UnOrderedList,
    XStack: Container,
    YStack: Container,
    useForm: jest.requireActual('react-hook-form').useForm,
    useThemeName: () => 'dark',
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

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeRedemptionEntryClick: (...args: unknown[]) => {
          mockPrimeRedemptionEntryClick(...args);
        },
        primeRedemptionResult: (...args: unknown[]) => {
          mockPrimeRedemptionResult(...args);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: true,
  },
}));

describe('PrimeRedeemLandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoggedIn = false;
    mockRouteParams = undefined;
    mockUser.displayEmail = 'user@example.com';
    mockUser.onekeyUserId = 'user-a';
    mockUser.primeSubscription = undefined;
    mockLoginOneKeyId.mockResolvedValue(undefined);
    mockFetchPrimeUserInfo.mockResolvedValue(undefined);
  });

  it('shows the redeem form and opens OneKey ID login from the primary button', async () => {
    render(<PrimeRedeemLandingPage />);

    expect(screen.getByTestId(PrimeTestIDs.redemptionCodeInput)).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.prime_not_logged_in_title),
    ).toBeNull();
    expect(screen.queryByText('user@example.com')).toBeNull();
    expect(screen.queryByTestId(PrimeTestIDs.redemptionSubmitBtn)).toBeNull();
    expect(
      screen.getByTestId(PrimeTestIDs.redemptionLoginBtn).textContent,
    ).toBe(ETranslations.sign_in_to_onekey_id__title);

    fireEvent.click(screen.getByTestId(PrimeTestIDs.redemptionLoginBtn));

    await waitFor(() => {
      expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
    });
    expect(mockRedeemPrimeCode).not.toHaveBeenCalled();
  });

  it('logs entry again after login with the current Prime status', () => {
    const { rerender } = render(<PrimeRedeemLandingPage />);

    expect(mockPrimeRedemptionEntryClick).toHaveBeenCalledTimes(1);
    expect(mockPrimeRedemptionEntryClick).toHaveBeenCalledWith({
      isPrimeActiveBeforeRedeem: false,
    });

    mockIsLoggedIn = true;
    mockUser.primeSubscription = { isActive: true };
    rerender(<PrimeRedeemLandingPage />);

    expect(mockPrimeRedemptionEntryClick).toHaveBeenCalledTimes(2);
    expect(mockPrimeRedemptionEntryClick).toHaveBeenLastCalledWith({
      isPrimeActiveBeforeRedeem: true,
    });
  });

  it('reports OneKey ID login failures instead of swallowing them', async () => {
    const error = new Error('login failed');
    mockLoginOneKeyId.mockRejectedValue(error);
    render(<PrimeRedeemLandingPage />);

    fireEvent.click(screen.getByTestId(PrimeTestIDs.redemptionLoginBtn));

    await waitFor(() => {
      expect(mockShowOneKeyIdLoginFailedToast).toHaveBeenCalledWith({
        error,
        intl: expect.anything(),
      });
    });
  });

  it('prefills a logged-out code from the route without redeeming', () => {
    mockRouteParams = { code: '  OKP-PJ37L-DYXWR  ' };

    render(<PrimeRedeemLandingPage />);

    expect(
      (screen.getByTestId(PrimeTestIDs.redemptionCodeInput) as HTMLInputElement)
        .value,
    ).toBe('OKP-PJ37L-DYXWR');
    expect(screen.getByTestId(PrimeTestIDs.redemptionLoginBtn)).toBeTruthy();
    expect(mockRedeemPrimeCode).not.toHaveBeenCalled();
  });

  it('prefills the code from the route and redeems', async () => {
    mockIsLoggedIn = true;
    mockRouteParams = { code: '  OKP-PJ37L-DYXWR  ' };
    mockRedeemPrimeCode.mockResolvedValue({
      addedDays: 30,
      finalExpiresAt: 1_800_000_000_000,
    });

    render(<PrimeRedeemLandingPage />);

    expect(
      (screen.getByTestId(PrimeTestIDs.redemptionCodeInput) as HTMLInputElement)
        .value,
    ).toBe('OKP-PJ37L-DYXWR');
    expect(screen.getByText('user@example.com')).toBeTruthy();
    expect(mockPrimeRedemptionEntryClick).toHaveBeenCalledWith({
      isPrimeActiveBeforeRedeem: false,
    });

    fireEvent.click(screen.getByTestId(PrimeTestIDs.redemptionSubmitBtn));

    await waitFor(() => {
      expect(screen.getByTestId(PrimeTestIDs.redemptionSuccess)).toBeTruthy();
    });
    expect(mockRedeemPrimeCode).toHaveBeenCalledWith({
      code: 'OKP-PJ37L-DYXWR',
      expectedOneKeyUserId: 'user-a',
    });
    expect(mockPrimeRedemptionResult).toHaveBeenCalledWith({
      result: 'success',
      isPrimeActiveBeforeRedeem: false,
      addedDays: 30,
    });
  });

  it('shows a server eligibility error inline', async () => {
    mockIsLoggedIn = true;
    mockUser.primeSubscription = { isActive: true };
    mockRouteParams = { code: 'OKP-PJ37L-DYXWR' };
    const serverMessage = '当前订阅不支持兑换；不会影响订阅扣款日期';
    mockRedeemPrimeCode.mockRejectedValue({
      code: 90_506,
      data: {
        code: 90_506,
        message: serverMessage,
      },
      message: serverMessage,
    });

    render(<PrimeRedeemLandingPage />);
    fireEvent.click(screen.getByTestId(PrimeTestIDs.redemptionSubmitBtn));

    expect(await screen.findByText(serverMessage)).toBeTruthy();
    expect(mockPrimeRedemptionResult).toHaveBeenCalledWith({
      result: 'failed',
      isPrimeActiveBeforeRedeem: true,
      errorCode: 90_506,
    });
  });

  it('re-prompts OneKey ID login when the session is expired', async () => {
    mockIsLoggedIn = true;
    mockRouteParams = { code: 'OKP-PJ37L-DYXWR' };
    const message = '用户认证失败，请重试登录。';
    mockRedeemPrimeCode.mockRejectedValue({
      key: ETranslations.id_login_expired_description,
      message,
    });

    render(<PrimeRedeemLandingPage />);
    fireEvent.click(screen.getByTestId(PrimeTestIDs.redemptionSubmitBtn));

    await waitFor(() => {
      expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(message)).toBeNull();
    expect(mockPrimeRedemptionResult).toHaveBeenCalledWith({
      result: 'failed',
      isPrimeActiveBeforeRedeem: false,
      errorCode: undefined,
    });
  });
});
