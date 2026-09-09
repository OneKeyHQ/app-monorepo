/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EmailOTPDialog } from './EmailOTPDialog';
import { createEmailOtpRateLimitError } from './emailOtpRateLimitError';

const mockOneKeyIdLoginFailedReason = jest.fn();

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

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        onekeyIdLoginFailedReason: (...args: unknown[]) => {
          mockOneKeyIdLoginFailedReason(...args);
        },
      },
    },
  },
}));

describe('EmailOTPDialog', () => {
  const rateLimitError = createEmailOtpRateLimitError({
    message: 'Please retry after 33 seconds.',
    retryAfterSeconds: 33,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('synchronizes the resend countdown with a server cooldown error', async () => {
    const sendCode = jest.fn().mockRejectedValue(rateLimitError);

    render(
      <EmailOTPDialog
        title="Enter verification code"
        description="Sent to test@example.com"
        sendCode={sendCode}
        onConfirm={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (33s)`,
      );
    });
    expect(Toast.error).toHaveBeenCalledWith({
      title: ETranslations.email_verification_rate_limit,
    });
    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledWith({
      reason:
        'Email verification code request failed: name=OneKeyLocalError message=Please retry after 33 seconds. code=-99999 status= requestId=',
    });
  });

  test('synchronizes the resend countdown after a manual resend', async () => {
    const sendCode = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(rateLimitError);

    render(
      <EmailOTPDialog
        title="Enter verification code"
        description="Sent to test@example.com"
        sendCode={sendCode}
        onConfirm={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (33s)`,
      );
    });
  });
});
