/** @jest-environment jsdom */

import { type ComponentProps, StrictMode } from 'react';

import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { WebView } from 'react-native-webview';

import { Toast } from '@onekeyhq/components';
import { createEmailOtpRateLimitError } from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpRateLimitError';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { markOneKeyIdFailureServerLogged } from '../oneKeyIdLoginToastUtils';

import { PrimeLoginEmailCodeDialogV2 as BusinessEmailCodeDialog } from './PrimeLoginEmailCodeDialogV2';

function PrimeLoginEmailCodeDialogV2(
  props: ComponentProps<typeof BusinessEmailCodeDialog>,
) {
  return (
    <BusinessEmailCodeDialog
      captchaConfig={{ enabled: false, pageUrl: '' }}
      {...props}
    />
  );
}

let mockTestEndpointEnabled = false;

let mockCaptchaFrameMode: 'provider' | 'web' | 'native' | 'desktop' =
  'provider';
const originalDesktopApi = globalThis.desktopApiProxy;

jest.mock('react-native-webview', () => ({
  WebView: jest.fn(() => null),
}));

jest.mock('@onekeyhq/kit/src/components/Captcha/CaptchaFrame', () => ({
  __esModule: true,
  default: (
    props: import('@onekeyhq/kit/src/components/Captcha/captchaMessage').ICaptchaFrameProps,
  ) => {
    if (mockCaptchaFrameMode !== 'provider') {
      const { default: Frame } = jest.requireActual<
        typeof import('@onekeyhq/kit/src/components/Captcha/CaptchaFrame')
      >(
        {
          web: '@onekeyhq/kit/src/components/Captcha/CaptchaFrame',
          native: '@onekeyhq/kit/src/components/Captcha/CaptchaFrame.native',
          desktop: '@onekeyhq/kit/src/components/Captcha/CaptchaFrame.desktop',
        }[mockCaptchaFrameMode],
      );
      return <Frame {...props} />;
    }
    const { requestId, onResult } = props;
    return (
      <div data-testid="test-captcha-frame" data-url={props.url}>
        <button
          type="button"
          onClick={() =>
            onResult({
              type: 'onekey-test-captcha',
              requestId,
              status: 'ready',
            })
          }
        >
          Provider ready
        </button>
        <button
          type="button"
          onClick={() =>
            onResult({
              type: 'onekey-test-captcha',
              requestId,
              status: 'load-error',
            })
          }
        >
          Provider could not load
        </button>
        <button
          type="button"
          onClick={() =>
            onResult({
              type: 'onekey-test-captcha',
              requestId,
              status: 'error',
            })
          }
        >
          Provider verification failed
        </button>
        <button
          type="button"
          onClick={() =>
            onResult({
              type: 'onekey-test-captcha',
              requestId,
              status: 'expired',
            })
          }
        >
          Provider verification expired
        </button>
        <button
          type="button"
          onClick={() =>
            onResult({
              type: 'onekey-test-captcha',
              requestId,
              status: 'success',
              token: 'fresh-captcha-token',
            })
          }
        >
          Complete provider verification
        </button>
      </div>
    );
  },
}));

const mockCopyText = jest.fn();
const mockOneKeyIdLoginFailedReason = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: {
        seconds?: number;
        onekey?: (
          chunks: import('react').ReactNode[],
        ) => import('react').ReactNode;
      },
    ) => {
      if (id === 'resend_code_countdown__action') {
        return `${id} (${String(values?.seconds)}s)`;
      }
      if (id === 'onekey_id_verification_email_hint__desc') {
        return values?.onekey?.(['OneKey']) ?? id;
      }
      return id;
    },
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = ({
    children,
    testID,
  }: {
    children?: import('react').ReactNode;
    testID?: string;
  }) => React.createElement('div', { 'data-testid': testID }, children);

  return {
    Alert: ({
      description,
      descriptionComponent,
      action,
    }: {
      description?: string;
      descriptionComponent?: import('react').ReactNode;
      action?: {
        primary: string;
        onPrimaryPress?: () => void;
        isPrimaryDisabled?: boolean;
      };
    }) =>
      React.createElement(
        'div',
        null,
        description,
        descriptionComponent,
        action
          ? React.createElement(
              'button',
              {
                type: 'button',
                onClick: action.onPrimaryPress,
                disabled: action.isPrimaryDisabled,
              },
              action.primary,
            )
          : null,
      ),
    Button: ({
      children,
      disabled,
      onPress,
    }: {
      children?: import('react').ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-disabled': disabled,
          onClick: onPress,
          type: 'button',
        },
        children,
      ),
    Dialog: {
      Description: Container,
      Footer: ({
        confirmButtonProps,
        onConfirm,
        extraContent,
      }: {
        confirmButtonProps?: { disabled?: boolean };
        onConfirm?: (args: { preventClose: () => void }) => void;
        extraContent?: import('react').ReactNode;
      }) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'button',
            {
              disabled: confirmButtonProps?.disabled,
              onClick: () => onConfirm?.({ preventClose: jest.fn() }),
              type: 'button',
            },
            'confirm',
          ),
          extraContent,
        ),
      Header: Container,
      Icon: () => null,
      Title: Container,
    },
    Icon: () => null,
    Input: React.forwardRef<
      HTMLInputElement,
      {
        autoFocus?: boolean;
        disabled?: boolean;
        error?: boolean;
        maxLength?: number;
        onChangeText?: (value: string) => void;
        placeholder?: string;
        testID?: string;
        value?: string;
      }
    >(
      (
        {
          autoFocus,
          disabled,
          error,
          maxLength,
          onChangeText,
          placeholder,
          testID,
          value,
        },
        ref,
      ) =>
        React.createElement('input', {
          ref,
          autoFocus,
          disabled,
          'data-error': String(error),
          'data-testid': testID,
          maxLength,
          onChange: (event: import('react').ChangeEvent<HTMLInputElement>) =>
            onChangeText?.(event.target.value),
          placeholder,
          value,
        }),
    ),
    SizableText: ({
      children,
      onPress,
      role,
      testID,
    }: {
      children?: import('react').ReactNode;
      onPress?: () => void;
      role?: string;
      testID?: string;
    }) =>
      React.createElement(
        'span',
        {
          'data-testid': testID,
          onClick: onPress,
          role,
        },
        children,
      ),
    Spinner: () => null,
    Stack: Container,
    Toast: {
      error: jest.fn(),
    },
    XStack: Container,
    YStack: Container,
    useClipboard: () => ({ copyText: mockCopyText }),
  };
});

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ isReady: true }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    {
      enabled: mockTestEndpointEnabled,
      settings: { enableTestEndpoint: mockTestEndpointEnabled },
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        onekeyIdLoginFailedReason: (...args: unknown[]) => {
          mockOneKeyIdLoginFailedReason(...args);
        },
      },
    },
    referral: {
      page: {
        signupOneKeyID: jest.fn(),
        signupOneKeyIDResult: jest.fn(),
      },
    },
  },
}));

jest.mock('../PrimeDevUtils/DevOTPAutoFill', () => ({
  DevOTPAutoFill: () => null,
}));

describe('PrimeLoginEmailCodeDialogV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaptchaFrameMode = 'provider';
    mockTestEndpointEnabled = false;
  });

  test.each([
    { testEndpoint: false, pageUrl: 'https://login.onekey.so/captcha' },
    { testEndpoint: true, pageUrl: 'https://login.onekeytest.com/captcha' },
  ])(
    'normal login requires CAPTCHA with test endpoint=$testEndpoint',
    async ({ testEndpoint, pageUrl }) => {
      mockTestEndpointEnabled = testEndpoint;
      const sendCode = jest.fn().mockResolvedValue(undefined);
      const loginWithCode = jest.fn().mockResolvedValue(undefined);
      render(
        <BusinessEmailCodeDialog
          email="test@example.com"
          sendCode={sendCode}
          loginWithCode={loginWithCode}
        />,
      );
      await waitFor(() =>
        expect(
          screen.getByTestId('test-captcha-frame').getAttribute('data-url'),
        ).toContain(`${pageUrl}#requestId=`),
      );
      const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
      expect(input.disabled).toBe(true);
      expect(sendCode).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Complete provider verification'));
      await waitFor(() => expect(input.disabled).toBe(false));
      expect(sendCode).toHaveBeenCalledWith({
        email: 'test@example.com',
        captchaToken: 'fresh-captcha-token',
      });
      fireEvent.change(input, { target: { value: '1234567890' } });
      fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
      await waitFor(() =>
        expect(loginWithCode).toHaveBeenCalledWith({
          email: 'test@example.com',
          code: '1234567890',
        }),
      );
    },
  );

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: originalDesktopApi,
    });
  });

  test.each([
    { isolatedTest: false, code: '123456' },
    { isolatedTest: false, code: '12345678' },
    { isolatedTest: false, code: '1234567890' },
    { isolatedTest: false, code: '7' },
    { isolatedTest: false, code: '00012345678901234567890' },
    { isolatedTest: true, code: '123456' },
    { isolatedTest: true, code: '12345678' },
    { isolatedTest: true, code: '1234567890' },
    { isolatedTest: true, code: '7' },
    { isolatedTest: true, code: '00012345678901234567890' },
  ])(
    'accepts $code with isolatedTest=$isolatedTest',
    async ({ isolatedTest, code }) => {
      const loginWithCode = jest.fn().mockResolvedValue(undefined);
      const onLoginSuccess = jest.fn();
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          isolatedTest={isolatedTest}
          sendCode={jest.fn().mockResolvedValue(undefined)}
          loginWithCode={loginWithCode}
          onLoginSuccess={onLoginSuccess}
        />,
      );
      const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
      expect(input.getAttribute('placeholder')).toBe(
        ETranslations.prime_enter_verification_code,
      );
      await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false));
      expect(document.activeElement).toBe(input);
      fireEvent.change(input, { target: { value: code } });
      expect(input.value).toBe(code);
      expect(input.hasAttribute('maxlength')).toBe(false);
      const confirm = screen.getByRole('button', { name: 'confirm' });
      await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false));
      fireEvent.click(confirm);
      await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
      expect(loginWithCode).toHaveBeenCalledWith({
        email: 'test@example.com',
        code,
      });
    },
  );

  test.each([false, true])(
    'shows and clears the same input error with isolatedTest=%s',
    async (isolatedTest) => {
      const loginWithCode = jest
        .fn()
        .mockRejectedValue(new Error('Invalid verification code'));
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          isolatedTest={isolatedTest}
          sendCode={jest.fn().mockResolvedValue(undefined)}
          loginWithCode={loginWithCode}
        />,
      );
      const input = screen.getByTestId('prime-otp-code');
      const confirm = screen.getByRole('button', { name: 'confirm' });
      await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false));
      fireEvent.change(input, { target: { value: '12345678' } });
      await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false));
      fireEvent.click(confirm);
      await waitFor(() =>
        expect(input.getAttribute('data-error')).toBe('true'),
      );
      expect(
        screen.getByText(ETranslations.prime_invalid_verification_code),
      ).toBeTruthy();
      fireEvent.change(input, { target: { value: '123456' } });
      expect(input.getAttribute('data-error')).toBe('false');
      expect(
        screen.queryByText(ETranslations.prime_invalid_verification_code),
      ).toBeNull();
    },
  );

  test.each([false, true])(
    'rejects empty or non-numeric codes with isolatedTest=%s',
    async (isolatedTest) => {
      const sendCode = jest.fn().mockResolvedValue(undefined);
      const loginWithCode = jest.fn();
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          isolatedTest={isolatedTest}
          sendCode={sendCode}
          loginWithCode={loginWithCode}
        />,
      );
      await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
      const input = screen.getByTestId('prime-otp-code');
      const confirm = screen.getByRole('button', { name: 'confirm' });
      for (const code of ['', 'abcdef']) {
        fireEvent.change(input, { target: { value: code } });
        expect(confirm.hasAttribute('disabled')).toBe(true);
        fireEvent.click(confirm);
      }
      expect(loginWithCode).not.toHaveBeenCalled();
    },
  );

  test('development StrictMode does not cancel the initial send permanently', async () => {
    const sendCode = jest.fn().mockResolvedValue(undefined);
    render(
      <StrictMode>
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          sendCode={sendCode}
          loginWithCode={jest.fn()}
          captchaConfig={{
            enabled: true,
            pageUrl: 'https://captcha.example.com',
          }}
        />
      </StrictMode>,
    );
    fireEvent.click(await screen.findByText('Complete provider verification'));
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
    expect(Toast.error).not.toHaveBeenCalled();
  });

  test.each(['failed', 'expired'])(
    'provider %s then retry success sends OTP once without pressing Resend',
    async (status) => {
      const sendCode = jest.fn().mockResolvedValue(undefined);
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          sendCode={sendCode}
          loginWithCode={jest.fn()}
          captchaConfig={{
            enabled: true,
            pageUrl: 'https://captcha.example.com',
          }}
        />,
      );
      const challenge = await screen.findByText(
        'Complete provider verification',
      );
      fireEvent.click(screen.getByText(`Provider verification ${status}`));
      fireEvent.click(challenge);
      await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
      expect(sendCode).toHaveBeenCalledWith({
        email: 'test@example.com',
        captchaToken: 'fresh-captcha-token',
      });
      expect(Toast.error).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Provider verification expired'));
      fireEvent.click(challenge);
      expect(sendCode).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Complete provider verification')).toBe(
        challenge,
      );
    },
  );

  test('waiting for CAPTCHA allows leaving silently and starts a fresh challenge on return', async () => {
    const sendCode = jest.fn().mockResolvedValue(undefined);
    const onChooseAnotherSignInMethod = jest.fn();
    const controls = jest.fn(() => null);
    const props = {
      email: 'test@example.com',
      sendCode,
      loginWithCode: jest.fn(),
      onChooseAnotherSignInMethod,
      developmentControls: controls,
      captchaConfig: {
        enabled: true,
        pageUrl: 'https://captcha.example.com',
      },
    };
    const { rerender } = render(<PrimeLoginEmailCodeDialogV2 {...props} />);
    const challenge = await screen.findByText('Complete provider verification');
    expect(screen.queryByText(ETranslations.prime_sent_to)).toBeNull();
    expect(screen.getByText(props.email)).toBeTruthy();
    expect(controls).toHaveBeenLastCalledWith(false);
    const back = screen.getByRole('button', {
      name: ETranslations.choose_another_sign_in_method__action,
    });
    expect(back.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(back);
    await waitFor(() =>
      expect(onChooseAnotherSignInMethod).toHaveBeenCalledTimes(1),
    );
    expect(screen.queryByText('Complete provider verification')).toBeNull();
    expect(sendCode).not.toHaveBeenCalled();
    expect(Toast.error).not.toHaveBeenCalled();
    expect(mockOneKeyIdLoginFailedReason).not.toHaveBeenCalled();
    rerender(<PrimeLoginEmailCodeDialogV2 {...props} active={false} />);
    rerender(<PrimeLoginEmailCodeDialogV2 {...props} active />);
    const freshChallenge = await screen.findByText(
      'Complete provider verification',
    );
    expect(freshChallenge).not.toBe(challenge);
    fireEvent.click(freshChallenge);
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
    expect(screen.getByText(ETranslations.prime_sent_to)).toBeTruthy();
  });

  test('changing the server while waiting cancels the old attempt and keeps manual resend usable', async () => {
    const sendCode = jest.fn().mockResolvedValue(undefined);
    const props = {
      email: 'test@example.com',
      sendCode,
      loginWithCode: jest.fn(),
      captchaConfig: {
        enabled: true,
        pageUrl: 'https://captcha.example.com',
      },
    };
    const { rerender } = render(<PrimeLoginEmailCodeDialogV2 {...props} />);
    await screen.findByText('Complete provider verification');
    rerender(
      <PrimeLoginEmailCodeDialogV2 {...props} developmentConfigRevision={1} />,
    );
    await waitFor(() =>
      expect(screen.queryByText('Complete provider verification')).toBeNull(),
    );
    expect(sendCode).not.toHaveBeenCalled();
    expect(Toast.error).not.toHaveBeenCalled();
    const resend = screen.getByRole('button', {
      name: ETranslations.prime_code_resend,
    });
    expect(resend.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(resend);
    fireEvent.click(await screen.findByText('Complete provider verification'));
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
  });

  test('a blocked provider load shows an error and an explicit resend recovers', async () => {
    const sendCode = jest.fn().mockResolvedValue(undefined);
    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={sendCode}
        loginWithCode={jest.fn()}
        captchaConfig={{
          enabled: true,
          pageUrl: 'https://captcha.example.com',
        }}
      />,
    );
    const failedProvider = await screen.findByText('Provider could not load');
    expect(
      screen.getByRole('button', { name: ETranslations.global_processing }),
    ).toBeTruthy();
    expect(screen.getByTestId('prime-otp-code').hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(failedProvider);
    await waitFor(() =>
      expect(Toast.error).toHaveBeenCalledWith({
        title:
          'CAPTCHA could not load. Check your network connection and retry.',
      }),
    );
    expect(sendCode).not.toHaveBeenCalled();
    expect(screen.getByTestId('prime-otp-code').hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      screen.getByText(
        'CAPTCHA could not load. Check your network connection and retry.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Provider could not load')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: ETranslations.global_retry }),
    );
    expect(
      screen.queryByText(
        'CAPTCHA could not load. Check your network connection and retry.',
      ),
    ).toBeNull();
    fireEvent.click(await screen.findByText('Complete provider verification'));
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('prime-otp-code').hasAttribute('disabled')).toBe(
      false,
    );
  });

  test('keeps the original Resend copy and locks code entry until CAPTCHA and the send API both succeed', async () => {
    jest.useFakeTimers();
    let resolveSend!: () => void;
    const sendCode = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const loginWithCode = jest.fn();
    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={sendCode}
        loginWithCode={loginWithCode}
        captchaConfig={{
          enabled: true,
          pageUrl: 'https://captcha.example.com',
        }}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
    const confirm = screen.getByRole<HTMLButtonElement>('button', {
      name: 'confirm',
    });
    expect(input.disabled).toBe(true);
    expect(document.activeElement).not.toBe(input);
    expect(confirm.disabled).toBe(true);
    expect(
      screen.getByRole('button', { name: ETranslations.global_processing }),
    ).toBeTruthy();
    expect(screen.queryByText('Loading CAPTCHA…')).toBeNull();
    fireEvent.click(screen.getByText('Provider ready'));
    expect(screen.queryByText('Verifying CAPTCHA…')).toBeNull();
    fireEvent.click(screen.getByText('Provider verification failed'));
    await act(async () => jest.advanceTimersByTime(180_000));
    expect(
      screen.getByRole('button', { name: ETranslations.global_processing }),
    ).toBeTruthy();
    expect(input.disabled).toBe(true);
    expect(
      screen.queryByRole('button', { name: ETranslations.global_retry }),
    ).toBeNull();
    expect(Toast.error).not.toHaveBeenCalled();
    expect(sendCode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Complete provider verification'));
    await act(async () => {});
    expect(sendCode).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(confirm);
    expect(input.value).toBe('');
    expect(loginWithCode).not.toHaveBeenCalled();
    await act(async () => resolveSend());
    expect(input.disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(confirm.disabled).toBe(true);
    expect(
      screen.getByRole('button', {
        name: `${ETranslations.resend_code_countdown__action} (60s)`,
      }),
    ).toBeTruthy();
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(confirm);
    await act(async () => {});
    expect(loginWithCode).toHaveBeenCalledWith({
      email: 'test@example.com',
      code: '123456',
    });
  });

  test('keeps code entry locked after a rejected send without CAPTCHA, and enables it after a successful retry', async () => {
    let rejectSend!: (error: Error) => void;
    const sendCode = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectSend = reject;
          }),
      )
      .mockResolvedValue(undefined);
    const loginWithCode = jest.fn();
    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={sendCode}
        loginWithCode={loginWithCode}
        captchaConfig={{ enabled: false, pageUrl: '' }}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
    const confirm = screen.getByRole<HTMLButtonElement>('button', {
      name: 'confirm',
    });
    expect(input.disabled).toBe(true);
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
    await act(async () =>
      rejectSend(new AuthApiError('CAPTCHA rejected', 400, 'captcha_failed')),
    );
    expect(input.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(confirm);
    expect(input.value).toBe('');
    expect(confirm.disabled).toBe(true);
    expect(loginWithCode).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: ETranslations.prime_code_resend }),
    );
    await waitFor(() => expect(input.disabled).toBe(false));
    expect(sendCode).toHaveBeenCalledTimes(2);
  });

  test.each(['captcha load failure', 'server rejection'])(
    'a failed resend (%s) still allows submitting an earlier code',
    async (failure) => {
      jest.useFakeTimers();
      const sendCode = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(
          new AuthApiError('CAPTCHA rejected', 400, 'captcha_failed'),
        );
      const loginWithCode = jest.fn();
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          sendCode={sendCode}
          loginWithCode={loginWithCode}
          captchaConfig={{
            enabled: true,
            pageUrl: 'https://captcha.example.com',
          }}
        />,
      );
      const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
      fireEvent.click(screen.getByText('Complete provider verification'));
      await act(async () => {});
      expect(input.disabled).toBe(false);
      fireEvent.change(input, { target: { value: '123456' } });
      for (let second = 0; second < 60; second += 1) {
        await act(async () => jest.advanceTimersByTime(1000));
      }
      fireEvent.click(
        screen.getByRole('button', { name: ETranslations.prime_code_resend }),
      );
      expect(input.disabled).toBe(true);
      expect(input.value).toBe('');
      fireEvent.click(
        screen.getByText(
          failure === 'server rejection'
            ? 'Complete provider verification'
            : 'Provider could not load',
        ),
      );
      await act(async () => {});
      expect(sendCode).toHaveBeenCalledTimes(
        failure === 'server rejection' ? 2 : 1,
      );
      expect(input.disabled).toBe(false);
      fireEvent.change(input, { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
      await act(async () => {});
      expect(loginWithCode).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '123456',
      });
    },
  );

  test.each([
    new TypeError('Unexpected application error'),
    new Error('Unknown error'),
    new Error(
      'captcha protection: request disallowed (no captcha_token found)',
    ),
    new AuthApiError('Unknown rejection', 400, undefined),
    new OneKeyLocalError({
      message: 'Unknown error',
      data: { isEmailOtpSendFailure: false },
    }),
  ])(
    'an inconclusive send error ($message) allows code entry and submission',
    async (error) => {
      const sendCode = jest.fn().mockRejectedValue(error);
      const loginWithCode = jest.fn();
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          sendCode={sendCode}
          loginWithCode={loginWithCode}
        />,
      );
      const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
      const confirm = screen.getByRole<HTMLButtonElement>('button', {
        name: 'confirm',
      });
      await waitFor(() => expect(input.disabled).toBe(false));
      expect(screen.queryByText(ETranslations.prime_sent_to)).toBeNull();
      fireEvent.change(input, { target: { value: '123456' } });
      expect(confirm.disabled).toBe(false);
      fireEvent.click(confirm);
      await waitFor(() =>
        expect(loginWithCode).toHaveBeenCalledWith({
          email: 'test@example.com',
          code: '123456',
        }),
      );
    },
  );

  test.each([
    new AuthApiError('CAPTCHA rejected', 400, 'captcha_failed'),
    new AuthApiError('Rate limited', 429, 'over_email_send_rate_limit'),
    new AuthApiError(
      'For security purposes, you can only request this after 17 seconds.',
      400,
      undefined,
    ),
    {
      message:
        'For security purposes, you can only request this after 0 seconds.',
    },
    createEmailOtpRateLimitError({
      message: 'Rate limited',
      retryAfterSeconds: 33,
    }),
    new AuthRetryableFetchError('Failed to fetch', 0),
    new AuthRetryableFetchError('Network request failed', 0),
    new AuthApiError('Server error', 500, 'unexpected_failure'),
    new AuthApiError('Request timed out', 408, undefined),
    { name: 'TimeoutError', message: 'Request timed out' },
    { code: 'ETIMEDOUT', message: 'Request timed out' },
    { code: 'ERR_NETWORK', message: 'Network unavailable' },
    new OneKeyLocalError({
      message: 'CAPTCHA rejected',
      data: { isEmailOtpSendFailure: true },
    }),
    createEmailOtpRateLimitError({
      message: 'Rate limited',
      retryAfterSeconds: 60,
      isEmailOtpSendFailure: true,
    }),
  ])(
    'a known first-send failure ($message) keeps code entry disabled',
    async (error) => {
      const sendCode = jest.fn().mockRejectedValue(error);
      const loginWithCode = jest.fn();
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          sendCode={sendCode}
          loginWithCode={loginWithCode}
        />,
      );
      await waitFor(() => expect(Toast.error).toHaveBeenCalled());
      const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
      const confirm = screen.getByRole<HTMLButtonElement>('button', {
        name: 'confirm',
      });
      expect(input.disabled).toBe(true);
      fireEvent.change(input, { target: { value: '123456' } });
      expect(input.value).toBe('');
      expect(confirm.disabled).toBe(true);
      fireEvent.click(confirm);
      expect(loginWithCode).not.toHaveBeenCalled();
    },
  );

  test.each([
    { platform: 'web' as const, event: 'none' },
    { platform: 'web' as const, event: 'load' },
    { platform: 'web' as const, event: 'error' },
    { platform: 'native' as const, event: 'none' },
    { platform: 'desktop' as const, event: 'none' },
    { platform: 'desktop' as const, event: 'load' },
    { platform: 'desktop' as const, event: 'error' },
  ])(
    '$platform HTML access failure ($event) keeps loading visible and allows repeated retries without sending OTP',
    async ({ platform, event }) => {
      jest.useFakeTimers();
      mockCaptchaFrameMode = platform;
      Object.defineProperty(globalThis, 'desktopApiProxy', {
        configurable: true,
        value: {
          webview: {
            getPreloadJsContent: jest
              .fn()
              .mockResolvedValue('file:///static/preload.js'),
          },
        },
      });
      const sendCode = jest.fn();
      render(
        <PrimeLoginEmailCodeDialogV2
          email="test@example.com"
          sendCode={sendCode}
          loginWithCode={jest.fn()}
          captchaConfig={{
            enabled: true,
            pageUrl: 'https://login.onekeytest.com/captcha',
          }}
        />,
      );
      const sources: string[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await act(async () => {});
        expect(
          screen.getByTestId('prime-otp-code').hasAttribute('disabled'),
        ).toBe(true);
        expect(screen.getByTestId('email-otp-captcha-loading')).toBeTruthy();
        expect(
          screen.queryByRole('button', { name: ETranslations.global_retry }),
        ).toBeNull();
        if (platform === 'web') {
          const frame = screen.getByTitle<HTMLIFrameElement>(
            'Security verification',
          );
          sources.push(frame.src);
          expect(frame.style.visibility).toBe('hidden');
          // Error documents, redirects and CSP blocks can emit load without error.
          if (event === 'load') fireEvent.load(frame);
          if (event === 'error') fireEvent.error(frame);
        } else if (platform === 'desktop') {
          const frame = screen.getByTitle<HTMLElement & { src: string }>(
            'Security verification',
          );
          sources.push(frame.src);
          expect(frame.style.visibility).toBe('hidden');
          if (event === 'load') fireEvent(frame, new Event('did-finish-load'));
          if (event === 'error') {
            const failed = new Event('did-fail-load');
            Object.assign(failed, { isMainFrame: true, errorCode: -105 });
            fireEvent(frame, failed);
          }
        } else {
          const props = jest.mocked(WebView).mock.calls.at(-1)?.[0];
          expect(props?.containerStyle).toMatchObject({ opacity: 0 });
          const source = props?.source;
          sources.push(
            source && typeof source === 'object' && 'uri' in source
              ? source.uri
              : '',
          );
        }
        if (event !== 'error') {
          await act(async () => jest.advanceTimersByTime(29_999));
          expect(screen.getByTestId('email-otp-captcha-loading')).toBeTruthy();
          expect(
            screen.queryByRole('button', { name: ETranslations.global_retry }),
          ).toBeNull();
          await act(async () => jest.advanceTimersByTime(1));
        } else {
          await act(async () => {});
        }
        expect(screen.queryByTestId('email-otp-captcha-loading')).toBeNull();
        expect(screen.queryByTitle('Security verification')).toBeNull();
        expect(
          screen.getByText(
            'CAPTCHA could not load. Check your network connection and retry.',
          ),
        ).toBeTruthy();
        expect(sendCode).not.toHaveBeenCalled();
        expect(
          screen.getByTestId('prime-otp-code').hasAttribute('disabled'),
        ).toBe(true);
        const retry = screen.getByRole<HTMLButtonElement>('button', {
          name: ETranslations.global_retry,
        });
        expect(retry.disabled).toBe(false);
        if (attempt === 0) fireEvent.click(retry);
      }
      expect(sources[0]).toContain('requestId=');
      expect(sources[1]).not.toBe(sources[0]);
    },
  );

  test('uses the server retry-after value after the initial email OTP request is rate limited', async () => {
    const sendCode = jest.fn().mockRejectedValue(
      createEmailOtpRateLimitError({
        message: 'Please retry after 33 seconds.',
        retryAfterSeconds: 33,
      }),
    );

    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={sendCode}
        loginWithCode={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(
        screen.getByRole('button', {
          name: `${ETranslations.resend_code_countdown__action} (33s)`,
        }),
      ).toBeTruthy();
    });
    expect(Toast.error).toHaveBeenCalledWith({
      title: ETranslations.email_verification_rate_limit,
    });
    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledWith({
      reason:
        'Prime email verification code request failed: name=OneKeyLocalError message=Please retry after 33 seconds. code=-99999 status= requestId=',
    });
  });

  test('uses the server retry-after value when Supabase rejects with its raw cooldown error', async () => {
    const sendCode = jest.fn().mockRejectedValue({
      code: 'over_email_send_rate_limit',
      message:
        'For security purposes, you can only request this after 17 seconds.',
    });

    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={sendCode}
        loginWithCode={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(
        screen.getByRole('button', {
          name: `${ETranslations.resend_code_countdown__action} (17s)`,
        }),
      ).toBeTruthy();
    });
    expect(Toast.error).toHaveBeenCalledWith({
      title: ETranslations.email_verification_rate_limit,
    });
  });

  test('does not resend when the email step is re-entered during the server cooldown', async () => {
    const sendCode = jest.fn().mockRejectedValue(
      createEmailOtpRateLimitError({
        message: 'Please retry after 33 seconds.',
        retryAfterSeconds: 33,
      }),
    );
    const props = {
      email: 'test@example.com',
      sendCode,
      loginWithCode: jest.fn(),
    };
    const { rerender } = render(
      <PrimeLoginEmailCodeDialogV2 {...props} active />,
    );

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('button', {
          name: `${ETranslations.resend_code_countdown__action} (33s)`,
        }),
      ).toBeTruthy();
    });

    rerender(<PrimeLoginEmailCodeDialogV2 {...props} active={false} />);
    rerender(<PrimeLoginEmailCodeDialogV2 {...props} active />);

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledTimes(1);
    });
  });

  test('copies the OneKey verification email sender name', async () => {
    const sendCode = jest.fn().mockResolvedValue(undefined);

    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={sendCode}
        loginWithCode={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: `${ETranslations.resend_code_countdown__action} (60s)`,
        }),
      ).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('prime-login-email-sender-copy'));

    expect(mockCopyText).toHaveBeenCalledWith('OneKey');
  });

  test('does not duplicate the background server event for an OTP login failure', async () => {
    const error = new Error('Invalid verification code');
    markOneKeyIdFailureServerLogged(error);
    const loginWithCode = jest.fn().mockRejectedValue(error);

    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={jest.fn().mockResolvedValue(undefined)}
        loginWithCode={loginWithCode}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('prime-otp-code').hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.change(screen.getByTestId('prime-otp-code'), {
      target: { value: '123456' },
    });
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'confirm' })
          .hasAttribute('disabled'),
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => {
      expect(loginWithCode).toHaveBeenCalledWith({
        code: '123456',
        email: 'test@example.com',
      });
      expect(
        screen.getByText(ETranslations.prime_invalid_verification_code),
      ).toBeTruthy();
    });
    expect(mockOneKeyIdLoginFailedReason).not.toHaveBeenCalled();
  });

  test('records an OTP failure that did not reach background diagnostics', async () => {
    const loginWithCode = jest
      .fn()
      .mockRejectedValue(new Error('Background bridge disconnected'));

    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={jest.fn().mockResolvedValue(undefined)}
        loginWithCode={loginWithCode}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('prime-otp-code').hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.change(screen.getByTestId('prime-otp-code'), {
      target: { value: '123456' },
    });
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'confirm' })
          .hasAttribute('disabled'),
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => {
      expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledTimes(1);
    });
    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledWith({
      reason: expect.stringContaining(
        'Prime email OTP login failed before background diagnostics',
      ),
    });
  });
  test('waits until sending is enabled and shows the normal error toast', async () => {
    const sendCode = jest
      .fn()
      .mockRejectedValue(
        new Error(
          'captcha protection: request disallowed (no captcha_token found)',
        ),
      );
    const props = {
      email: 'test@example.com',
      sendCode,
      loginWithCode: jest.fn(),
    };
    const { rerender } = render(
      <PrimeLoginEmailCodeDialogV2 {...props} sendCodeDisabled />,
    );
    expect(sendCode).not.toHaveBeenCalled();
    rerender(
      <PrimeLoginEmailCodeDialogV2 {...props} sendCodeDisabled={false} />,
    );
    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledTimes(1);
      expect(Toast.error).toHaveBeenCalledWith({
        title:
          'captcha protection: request disallowed (no captcha_token found)',
      });
    });
    rerender(<PrimeLoginEmailCodeDialogV2 {...props} sendCodeDisabled />);
    rerender(
      <PrimeLoginEmailCodeDialogV2 {...props} sendCodeDisabled={false} />,
    );
    expect(sendCode).toHaveBeenCalledTimes(1);
  });

  test('initial send and resend wait for CAPTCHA below submit without development controls', async () => {
    const sendCode = jest
      .fn()
      .mockRejectedValueOnce(new Error('Supabase request rejected'))
      .mockResolvedValue(undefined);
    render(
      <PrimeLoginEmailCodeDialogV2
        email="test@example.com"
        sendCode={sendCode}
        loginWithCode={jest.fn()}
        captchaConfig={{
          enabled: true,
          pageUrl: 'https://captcha.example.com',
        }}
      />,
    );
    const challenge = await screen.findByRole('button', {
      name: 'Complete provider verification',
    });
    expect(sendCode).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'confirm' })
        .compareDocumentPosition(challenge) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(challenge);
    await waitFor(() =>
      expect(Toast.error).toHaveBeenCalledWith({
        title: 'Supabase request rejected',
      }),
    );
    expect(sendCode).toHaveBeenCalledWith({
      email: 'test@example.com',
      captchaToken: 'fresh-captcha-token',
    });
    expect(screen.getByText('Complete provider verification')).toBe(challenge);
    fireEvent.click(challenge);
    expect(sendCode).toHaveBeenCalledTimes(1);
    const resend = screen.getByRole('button', {
      name: ETranslations.prime_code_resend,
    });
    fireEvent.click(resend);
    fireEvent.click(resend);
    const retryChallenge = screen.getByText('Complete provider verification');
    expect(retryChallenge).not.toBe(challenge);
    expect(sendCode).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Complete provider verification'));
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(2));
    expect(sendCode).toHaveBeenLastCalledWith({
      email: 'test@example.com',
      captchaToken: 'fresh-captcha-token',
    });
    expect(screen.getByText('Complete provider verification')).toBe(
      retryChallenge,
    );
    expect(screen.queryByText('Start / reset CAPTCHA')).toBeNull();
  });

  test('changing the development server clears the old code and requires an explicit resend', async () => {
    const sendCode = jest.fn().mockResolvedValue(undefined);
    const props = {
      email: 'test@example.com',
      sendCode,
      loginWithCode: jest.fn(),
    };
    const { rerender } = render(
      <PrimeLoginEmailCodeDialogV2 {...props} developmentConfigRevision={0} />,
    );
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByTestId('prime-otp-code'), {
      target: { value: '123456' },
    });
    rerender(
      <PrimeLoginEmailCodeDialogV2 {...props} developmentConfigRevision={1} />,
    );
    expect(screen.getByTestId('prime-otp-code').getAttribute('value')).toBe('');
    expect(screen.getByTestId('prime-otp-code').hasAttribute('disabled')).toBe(
      true,
    );
    expect(sendCode).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: ETranslations.prime_code_resend }),
    );
    await waitFor(() => expect(sendCode).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('prime-otp-code').hasAttribute('disabled')).toBe(
      false,
    );
  });
});
