/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { createEmailOtpRateLimitError } from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpRateLimitError';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { markOneKeyIdFailureServerLogged } from '../oneKeyIdLoginToastUtils';

import { PrimeLoginEmailCodeDialogV2 } from './PrimeLoginEmailCodeDialogV2';

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
  const React = jest.requireActual('react');
  const Container = ({ children }: { children?: import('react').ReactNode }) =>
    React.createElement('div', null, children);

  return {
    Alert: ({
      descriptionComponent,
    }: {
      descriptionComponent?: import('react').ReactNode;
    }) => React.createElement('div', null, descriptionComponent),
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
      }: {
        confirmButtonProps?: { disabled?: boolean };
        onConfirm?: (args: { preventClose: () => void }) => void;
      }) =>
        React.createElement(
          'button',
          {
            disabled: confirmButtonProps?.disabled,
            onClick: () => onConfirm?.({ preventClose: jest.fn() }),
            type: 'button',
          },
          'confirm',
        ),
      Header: Container,
      Icon: () => null,
      Title: Container,
    },
    Icon: () => null,
    OTPInput: ({
      onTextChange,
      value,
    }: {
      onTextChange?: (value: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'data-testid': 'verification-code',
        onChange: (event: import('react').ChangeEvent<HTMLInputElement>) =>
          onTextChange?.(event.target.value),
        value,
      }),
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

jest.mock('@onekeyhq/kit/src/hooks/useIsMounted', () => ({
  useIsMounted: () => ({ current: true }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
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
  });

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

    fireEvent.change(screen.getByTestId('verification-code'), {
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

    fireEvent.change(screen.getByTestId('verification-code'), {
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
});
