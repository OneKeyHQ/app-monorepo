/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { createEmailOtpRateLimitError } from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpRateLimitError';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PrimeLoginEmailCodeDialogV2 } from './PrimeLoginEmailCodeDialogV2';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { seconds?: number }) => {
      if (id === 'resend_code_countdown__action') {
        return `${id} (${String(values?.seconds)}s)`;
      }
      return id;
    },
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = ({ children }: { children?: import('react').ReactNode }) =>
    React.createElement('div', null, children);

  return {
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
      Footer: () => null,
      Header: Container,
      Icon: () => null,
      Title: Container,
    },
    OTPInput: () => null,
    SizableText: Container,
    Stack: Container,
    Toast: {
      error: jest.fn(),
    },
    XStack: Container,
    YStack: Container,
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
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (33s)`,
      );
    });
    expect(Toast.error).toHaveBeenCalledWith({
      title: ETranslations.email_verification_rate_limit,
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
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (17s)`,
      );
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
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (33s)`,
      );
    });

    rerender(<PrimeLoginEmailCodeDialogV2 {...props} active={false} />);
    rerender(<PrimeLoginEmailCodeDialogV2 {...props} active />);

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledTimes(1);
    });
  });
});
