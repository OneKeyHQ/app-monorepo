/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
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
          disabled,
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

  function advanceCountdown(seconds: number) {
    for (let second = 0; second < seconds; second += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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
      trigger: 'interactive',
      error: expect.objectContaining({
        message: 'Please retry after 33 seconds.',
      }),
    });
  });

  test('synchronizes the resend countdown after a manual resend', async () => {
    jest.useFakeTimers();
    const sendCode = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(rateLimitError);

    await act(async () => {
      render(
        <EmailOTPDialog
          title="Enter verification code"
          description="Sent to test@example.com"
          sendCode={sendCode}
          onConfirm={jest.fn()}
        />,
      );
    });
    expect(sendCode).toHaveBeenCalledTimes(1);
    advanceCountdown(60);
    expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(sendCode).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (33s)`,
      );
    });
  });

  test('shows the remaining OneKey server cooldown after reopening the dialog', async () => {
    jest.useFakeTimers();
    const error = toPlainErrorObject(
      new OneKeyServerApiError({
        code: 90_011,
        autoToast: true,
        message:
          'Please wait 26 seconds before requesting a new verification code',
        data: {
          code: 90_011,
          messageId: 'error__prime_otp_cooldown',
          retryAfterSec: 26,
        },
      }),
    );

    render(
      <EmailOTPDialog
        title="Enter verification code"
        description="Sent to test@example.com"
        sendCode={jest.fn().mockRejectedValue(error)}
        onConfirm={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (26s)`,
      );
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
        'true',
      );
    });
    expect(Toast.error).not.toHaveBeenCalled();
    for (let second = 0; second < 26; second += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByRole('button').textContent).toBe(
      ETranslations.prime_code_resend,
    );
    expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
      'false',
    );
  });

  test('uses the server relative delay instead of the code validity', async () => {
    const sendCode = jest.fn().mockResolvedValue({
      retryAfterSeconds: 27,
      resendAt: 300,
    });

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
        `${ETranslations.resend_code_countdown__action} (27s)`,
      );
    });
  });

  test.each([undefined, 0, -1, 1.5, NaN, Infinity])(
    'falls back to 60 seconds for an invalid successful delay: %s',
    async (retryAfterSeconds) => {
      jest.useFakeTimers();
      await act(async () => {
        render(
          <EmailOTPDialog
            title="Enter verification code"
            description="Sent to test@example.com"
            sendCode={jest.fn().mockResolvedValue({ retryAfterSeconds })}
            onConfirm={jest.fn()}
          />,
        );
      });

      advanceCountdown(59);
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (1s)`,
      );
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
        'true',
      );
      advanceCountdown(1);
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
        'false',
      );
    },
  );

  test.each([
    { trigger: 'initial', seconds: 61 },
    { trigger: 'initial', seconds: 300 },
    { trigger: 'resend', seconds: 18 },
    { trigger: 'resend', seconds: 61 },
    { trigger: 'resend', seconds: 300 },
  ])(
    'waits the full $seconds seconds after a successful $trigger send',
    async ({ trigger, seconds }) => {
      jest.useFakeTimers();
      const sendCode = jest
        .fn()
        .mockResolvedValue({ retryAfterSeconds: seconds });
      if (trigger === 'resend') {
        sendCode.mockResolvedValueOnce(undefined);
      }

      await act(async () => {
        render(
          <EmailOTPDialog
            title="Enter verification code"
            description="Sent to test@example.com"
            sendCode={sendCode}
            onConfirm={jest.fn()}
          />,
        );
      });
      if (trigger === 'resend') {
        advanceCountdown(60);
        await act(async () => {
          fireEvent.click(screen.getByRole('button'));
        });
      }

      const requestCount = trigger === 'resend' ? 2 : 1;
      expect(sendCode).toHaveBeenCalledTimes(requestCount);
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (${Math.min(60, seconds)}s)`,
      );
      advanceCountdown(seconds - 1);
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (1s)`,
      );
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
        'true',
      );
      fireEvent.click(screen.getByRole('button'));
      expect(sendCode).toHaveBeenCalledTimes(requestCount);
      advanceCountdown(1);
      expect(screen.getByRole('button').textContent).toBe(
        ETranslations.prime_code_resend,
      );
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
        'false',
      );
    },
  );

  test.each([
    { trigger: 'initial', seconds: 61 },
    { trigger: 'initial', seconds: 300 },
    { trigger: 'resend', seconds: 61 },
    { trigger: 'resend', seconds: 300 },
  ])(
    'waits the full $seconds-second server cooldown for the $trigger request',
    async ({ trigger, seconds }) => {
      jest.useFakeTimers();
      const error = toPlainErrorObject(
        new OneKeyServerApiError({
          code: 90_011,
          autoToast: true,
          message: `Please wait ${seconds} seconds before requesting a new verification code`,
          data: { retryAfterSec: seconds },
        }),
      );
      const sendCode = jest.fn().mockRejectedValue(error);
      if (trigger === 'resend') {
        sendCode.mockResolvedValueOnce(undefined);
      }

      await act(async () => {
        render(
          <EmailOTPDialog
            title="Enter verification code"
            description="Sent to test@example.com"
            sendCode={sendCode}
            onConfirm={jest.fn()}
          />,
        );
      });
      if (trigger === 'resend') {
        advanceCountdown(60);
        await act(async () => {
          fireEvent.click(screen.getByRole('button'));
        });
      }

      const requestCount = trigger === 'resend' ? 2 : 1;
      expect(sendCode).toHaveBeenCalledTimes(requestCount);
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (60s)`,
      );
      advanceCountdown(60);
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
        'true',
      );
      fireEvent.click(screen.getByRole('button'));
      expect(sendCode).toHaveBeenCalledTimes(requestCount);
      advanceCountdown(seconds - 61);
      expect(screen.getByRole('button').textContent).toBe(
        `${ETranslations.resend_code_countdown__action} (1s)`,
      );
      advanceCountdown(1);
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe(
        'false',
      );
      expect(Toast.error).not.toHaveBeenCalled();
    },
  );
});
