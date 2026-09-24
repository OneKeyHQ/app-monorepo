/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { createClient } from '@supabase/supabase-js';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { ONEKEY_ID_AUTH_CONFIG } from '@onekeyhq/shared/src/consts/authConsts';

import { useEmailOtpDevTools } from './useEmailOtpDevTools';

let mockDevSettingsEnabled = true;
let mockTestEndpointEnabled = false;
const mockSendCode = jest.fn();
const mockLoginWithCode = jest.fn();
const mockPasswordSuccess = jest.fn();
const mockPasswordFailure = jest.fn();
const PROJECT_URLS = {
  production: ONEKEY_ID_AUTH_CONFIG.prod.projectUrl,
  test: 'https://test.supabase.co',
  'test-2': ONEKEY_ID_AUTH_CONFIG.test.projectUrl,
  'test-3': 'https://test-3.supabase.co',
};

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    {
      enabled: mockDevSettingsEnabled,
      settings: { enableTestEndpoint: mockTestEndpointEnabled },
    },
  ],
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  const Button = ({
    children,
    onPress,
    testID,
    variant,
    disabled,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    variant?: string;
    disabled?: boolean;
  }) => (
    <button
      data-testid={testID}
      data-variant={variant}
      onClick={onPress}
      type="button"
      disabled={disabled}
    >
      {children}
    </button>
  );
  return {
    Button,
    IconButton: Button,
    Input: ({
      testID,
      value,
      onChangeText,
    }: {
      testID?: string;
      value?: string;
      onChangeText?: (value: string) => void;
    }) => (
      <input
        data-testid={testID}
        value={value}
        onChange={(event) => onChangeText?.(event.target.value)}
      />
    ),
    SizableText: Container,
    Stack: Container,
    Switch: ({
      testID,
      value,
      onChange,
      disabled,
    }: {
      testID?: string;
      value: boolean;
      onChange: (value: boolean) => void;
      disabled?: boolean;
    }) => (
      <button
        type="button"
        role="switch"
        aria-label={testID}
        aria-checked={value}
        disabled={disabled}
        data-testid={testID}
        onClick={() => onChange(!value)}
      />
    ),
    XStack: Container,
    Toast: { success: jest.fn(), error: jest.fn() },
    Alert: ({
      description,
      action,
    }: {
      description: string;
      action: {
        primaryTestID: string;
        isPrimaryDisabled: boolean;
        onPrimaryPress: () => void;
      };
    }) => (
      <div>
        {description}
        <button
          type="button"
          data-testid={action.primaryTestID}
          disabled={action.isPrimaryDisabled}
          onClick={action.onPrimaryPress}
        >
          Retry
        </button>
      </div>
    ),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/supabase/requestEmailOtp',
  () => ({ requestEmailOtp: jest.fn() }),
);
jest.mock('@onekeyhq/kit/src/components/Captcha/CaptchaFrame', () => ({
  __esModule: true,
  default: ({
    requestId,
    onResult,
  }: import('@onekeyhq/kit/src/components/Captcha/captchaMessage').ICaptchaFrameProps) => (
    <div data-testid="reset-password-captcha" data-request-id={requestId}>
      <button
        type="button"
        onClick={() =>
          onResult({
            type: 'onekey-test-captcha',
            requestId,
            status: 'success',
            token: `token-${requestId}`,
          })
        }
      >
        Complete reset CAPTCHA
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
        Fail reset CAPTCHA
      </button>
    </div>
  ),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false },
}));
jest.mock('@onekeyhq/kit/src/components/Captcha/dev/emailOtpTestConfig', () => {
  const { ONEKEY_ID_AUTH_CONFIG: authConfig } = jest.requireActual<
    typeof import('@onekeyhq/shared/src/consts/authConsts')
  >('@onekeyhq/shared/src/consts/authConsts');
  return {
    EMAIL_OTP_CAPTCHA_PAGE_URLS: {
      test: 'https://login.onekeytest.com/captcha',
      production: 'https://login.onekey.so/captcha',
    },
    EMAIL_OTP_TEST_PROJECTS: [
      {
        id: 'test',
        label: 'Test1',
        projectUrl: 'https://test.supabase.co',
        publicKey: 'sb_publishable_fixture_test',
      },
      {
        id: 'test-2',
        label: 'Test2',
        projectUrl: authConfig.test.projectUrl,
        publicKey: 'onekey-123-321-000-999-888',
      },
      {
        id: 'test-3',
        label: 'Test3',
        projectUrl: 'https://test-3.supabase.co',
        publicKey: 'sb_publishable_fixture_test_3',
      },
    ],
  };
});

function Harness({
  openCount,
  email = 'test@example.com',
  authActionPending = false,
}: {
  openCount: number;
  email?: string;
  authActionPending?: boolean;
}) {
  const devAuth = useEmailOtpDevTools({
    openCount,
    email,
    sendCode: mockSendCode,
    loginWithCode: mockLoginWithCode,
  });
  return (
    <>
      {devAuth.renderControls(false, authActionPending)}
      <button
        type="button"
        onClick={() => void devAuth.sendCode({ email: 'test@example.com' })}
      >
        Send test code
      </button>
      <button
        type="button"
        onClick={() =>
          void devAuth.loginWithCode({
            email: 'test@example.com',
            code: '123456',
          })
        }
      >
        Verify test code
      </button>
      <span data-testid="captcha-override">
        {String(devAuth.captchaOverride?.enabled)}
      </span>
      <span data-testid="test-project-active">
        {String(devAuth.isTestProject)}
      </span>
      <span data-testid="password-login-active">
        {String(devAuth.isPasswordLogin)}
      </span>
      <button
        type="button"
        onClick={() =>
          void devAuth
            .loginWithPassword({
              email: 'test@example.com',
              password: ' Abc!中文🔐 01 ',
              captchaToken: 'password-captcha-token',
            })
            .then(mockPasswordSuccess, mockPasswordFailure)
        }
      >
        Sign in with test password
      </button>
    </>
  );
}

describe('email OTP debug panel without a development build', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevSettingsEnabled = true;
    mockTestEndpointEnabled = false;
  });

  test.each(['initially disabled', 'disabled after selecting Test2'])(
    'developer mode %s prevents test clients and CAPTCHA overrides',
    async (scenario) => {
      mockDevSettingsEnabled = scenario !== 'initially disabled';
      const { rerender } = render(<Harness openCount={1} />);
      if (mockDevSettingsEnabled) {
        fireEvent.click(screen.getByTestId('prime-otp-use-test-2'));
        expect(screen.getByTestId('test-project-active').textContent).toBe(
          'true',
        );
        expect(screen.getByTestId('captcha-override').textContent).toBe('true');
        mockDevSettingsEnabled = false;
        rerender(<Harness openCount={1} />);
      }
      expect(screen.queryByTestId('prime-email-otp-dev-controls')).toBeNull();
      expect(screen.getByTestId('test-project-active').textContent).toBe(
        'false',
      );
      expect(screen.getByTestId('captcha-override').textContent).toBe(
        'undefined',
      );
      await act(async () =>
        fireEvent.click(screen.getByText('Send test code')),
      );
      await act(async () =>
        fireEvent.click(screen.getByText('Verify test code')),
      );
      expect(mockSendCode).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockLoginWithCode).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '123456',
      });
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  test('stays hidden until requested and can reopen with its configuration', () => {
    const { rerender } = render(<Harness openCount={0} />);
    expect(screen.queryByTestId('prime-email-otp-dev-controls')).toBeNull();

    rerender(<Harness openCount={1} />);
    expect(screen.getByTestId('prime-email-otp-dev-controls')).toBeTruthy();
    fireEvent.click(screen.getByTestId('prime-otp-use-test'));
    expect(screen.getByTestId('test-project-active').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('prime-otp-close-dev-controls'));
    expect(screen.queryByTestId('prime-email-otp-dev-controls')).toBeNull();
    expect(screen.getByTestId('test-project-active').textContent).toBe('true');

    rerender(<Harness openCount={2} />);
    expect(screen.getByTestId('prime-email-otp-dev-controls')).toBeTruthy();
    expect(
      screen.getByTestId('prime-otp-supabase-url').getAttribute('value'),
    ).toBe('https://test.supabase.co');
  });

  test.each(['production', 'test', 'test-2', 'test-3'] as const)(
    'password mode forwards the exact password and CAPTCHA token to %s in an isolated session',
    async (project) => {
      const signInWithPassword = jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'fixture-session',
            user: { id: 'fixture-user' },
          },
        },
        error: null,
      });
      const getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'fixture-user' } },
        error: null,
      });
      (createClient as jest.Mock).mockReturnValue({
        auth: { signInWithPassword, getUser },
      });
      render(<Harness openCount={1} />);
      fireEvent.click(screen.getByTestId(`prime-otp-use-${project}`));
      fireEvent.click(screen.getByTestId('prime-otp-password-login'));
      expect(screen.getByTestId('password-login-active').textContent).toBe(
        'true',
      );
      await act(async () =>
        fireEvent.click(screen.getByText('Sign in with test password')),
      );
      await waitFor(() => expect(mockPasswordSuccess).toHaveBeenCalledTimes(1));
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: ' Abc!中文🔐 01 ',
        options: { captchaToken: 'password-captcha-token' },
      });
      expect(getUser).toHaveBeenCalledWith('fixture-session');
      expect(createClient).toHaveBeenCalledWith(
        PROJECT_URLS[project],
        project === 'test-2'
          ? 'onekey-123-321-000-999-888'
          : expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false,
            autoRefreshToken: false,
          }),
        }),
      );
      expect(mockSendCode).not.toHaveBeenCalled();
      expect(mockLoginWithCode).not.toHaveBeenCalled();
    },
  );

  test.each(['SDK rejection', 'missing session', 'mismatched user'])(
    'password login does not report success for %s',
    async (scenario) => {
      const sdkError = new Error('Invalid login credentials');
      const signInWithPassword = jest.fn().mockResolvedValue({
        data: {
          session:
            scenario === 'missing session'
              ? null
              : {
                  access_token: 'fixture-session',
                  user: { id: 'fixture-user' },
                },
        },
        error: scenario === 'SDK rejection' ? sdkError : null,
      });
      const getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'different-user' } },
        error: null,
      });
      (createClient as jest.Mock).mockReturnValue({
        auth: { signInWithPassword, getUser },
      });
      render(<Harness openCount={1} />);
      fireEvent.click(screen.getByTestId('prime-otp-use-test-2'));
      fireEvent.click(screen.getByTestId('prime-otp-password-login'));
      await act(async () =>
        fireEvent.click(screen.getByText('Sign in with test password')),
      );
      expect(mockPasswordSuccess).not.toHaveBeenCalled();
      expect(mockPasswordFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            scenario === 'SDK rejection'
              ? sdkError.message
              : `Test Supabase ${
                  scenario === 'missing session'
                    ? 'returned no session.'
                    : 'session verification failed.'
                }`,
        }),
      );
      if (scenario !== 'mismatched user') {
        expect(getUser).not.toHaveBeenCalled();
      }
      expect(
        screen.getByTestId('prime-otp-password-login').hasAttribute('disabled'),
      ).toBe(false);
    },
  );

  test.each(['mode off', 'developer mode off'])(
    'password test API is inaccessible with %s',
    async (scenario) => {
      const { rerender } = render(<Harness openCount={1} />);
      if (scenario === 'developer mode off') {
        fireEvent.click(screen.getByTestId('prime-otp-password-login'));
        mockDevSettingsEnabled = false;
        rerender(<Harness openCount={1} />);
      }
      await act(async () =>
        fireEvent.click(screen.getByText('Sign in with test password')),
      );
      expect(mockPasswordFailure).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Password test mode is disabled.' }),
      );
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  test.each(['preset', 'url'])(
    'selecting each test project by %s uses only its matching key and selected state',
    async (selection) => {
      render(<Harness openCount={1} />);
      const projects = [
        {
          id: 'test',
          url: 'https://test.supabase.co',
          key: 'sb_publishable_fixture_test',
        },
        {
          id: 'test-2',
          url: ONEKEY_ID_AUTH_CONFIG.test.projectUrl,
          key: 'onekey-123-321-000-999-888',
        },
        {
          id: 'test-3',
          url: 'https://test-3.supabase.co',
          key: 'sb_publishable_fixture_test_3',
        },
      ];
      for (const project of projects) {
        if (selection === 'preset') {
          fireEvent.click(screen.getByTestId(`prime-otp-use-${project.id}`));
        } else {
          fireEvent.change(screen.getByTestId('prime-otp-supabase-url'), {
            target: { value: `${project.url}/` },
          });
        }
        expect(
          screen.getByTestId('prime-otp-supabase-url').getAttribute('value'),
        ).toBe(selection === 'preset' ? project.url : `${project.url}/`);
        expect(
          screen
            .getByTestId(`prime-otp-use-${project.id}`)
            .getAttribute('data-variant'),
        ).toBe('primary');
        expect(
          screen
            .getByTestId('prime-otp-use-production')
            .getAttribute('data-variant'),
        ).toBe('secondary');
        for (const other of projects.filter(({ id }) => id !== project.id)) {
          expect(
            screen
              .getByTestId(`prime-otp-use-${other.id}`)
              .getAttribute('data-variant'),
          ).toBe('secondary');
        }
        await act(async () =>
          fireEvent.click(screen.getByText('Send test code')),
        );
        expect(createClient).toHaveBeenLastCalledWith(
          selection === 'preset' ? project.url : `${project.url}/`,
          project.key,
          expect.objectContaining({
            auth: expect.objectContaining({
              flowType: 'pkce',
              persistSession: false,
            }),
          }),
        );
        expect(screen.queryByText(project.key)).toBeNull();
      }
      fireEvent.click(screen.getByTestId('prime-otp-use-test'));
      expect(
        screen.getByTestId('prime-otp-supabase-url').getAttribute('value'),
      ).toBe(projects[0].url);
    },
  );

  test('opening debug controls preserves the business environment and enabled CAPTCHA', () => {
    mockTestEndpointEnabled = true;
    render(<Harness openCount={1} />);
    expect(
      screen.getByTestId('prime-otp-supabase-url').getAttribute('value'),
    ).toBe(ONEKEY_ID_AUTH_CONFIG.test.projectUrl);
    expect(screen.getByTestId('prime-otp-captcha-page-url').textContent).toBe(
      'https://login.onekeytest.com/captcha',
    );
    expect(screen.getByTestId('captcha-override').textContent).toBe('true');
  });

  test.each(['preset', 'url'])(
    'production relay selected by %s retains normal OneKey ID sign-in',
    async (selection) => {
      render(<Harness openCount={1} />);
      fireEvent.click(screen.getByTestId('prime-otp-use-test-2'));
      if (selection === 'preset') {
        fireEvent.click(screen.getByTestId('prime-otp-use-production'));
      } else {
        fireEvent.change(screen.getByTestId('prime-otp-supabase-url'), {
          target: { value: `${ONEKEY_ID_AUTH_CONFIG.prod.projectUrl}/` },
        });
      }
      expect(screen.getByTestId('test-project-active').textContent).toBe(
        'false',
      );
      expect(
        screen
          .getByTestId('prime-otp-use-production')
          .getAttribute('data-variant'),
      ).toBe('primary');
      expect(
        screen.queryByText(/Warning: Direct Supabase connection/),
      ).toBeNull();
      await act(async () =>
        fireEvent.click(screen.getByText('Send test code')),
      );
      await act(async () =>
        fireEvent.click(screen.getByText('Verify test code')),
      );
      expect(mockSendCode).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockLoginWithCode).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '123456',
      });
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  test.each([
    'https://prime.onekeycn.com',
    'https://prime.onekeycn.com/prime/v1/other',
    `${ONEKEY_ID_AUTH_CONFIG.prod.projectUrl}?redirect=1`,
    'https://prime.onekeytest.com',
    'https://prime.onekeytest.com/prime/v1/other',
    `${ONEKEY_ID_AUTH_CONFIG.test.projectUrl}?redirect=1`,
  ])('rejects unconfigured relay URL %s', async (url) => {
    render(<Harness openCount={1} />);
    fireEvent.click(screen.getByTestId('prime-otp-use-test-2'));
    fireEvent.click(screen.getByTestId('prime-otp-password-login'));
    fireEvent.change(screen.getByTestId('prime-otp-supabase-url'), {
      target: { value: url },
    });
    await act(async () =>
      fireEvent.click(screen.getByText('Sign in with test password')),
    );
    expect(mockPasswordFailure).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });

  test('production debug selection on the test node uses an isolated production client', async () => {
    mockTestEndpointEnabled = true;
    render(<Harness openCount={1} />);
    fireEvent.click(screen.getByTestId('prime-otp-use-production'));
    await act(async () => fireEvent.click(screen.getByText('Send test code')));
    expect(createClient).toHaveBeenCalledWith(
      ONEKEY_ID_AUTH_CONFIG.prod.projectUrl,
      'onekey-123-321-000-999-888',
      expect.anything(),
    );
    expect(mockSendCode).not.toHaveBeenCalled();
    expect(screen.getByTestId('test-project-active').textContent).toBe('true');
  });

  test.each(['production', 'test', 'test-2', 'test-3'] as const)(
    'reset password uses %s, waits for CAPTCHA and never logs in',
    async (project) => {
      const resetPasswordForEmail = jest
        .fn()
        .mockResolvedValue({ error: null });
      jest.mocked(createClient).mockReturnValue({
        auth: { resetPasswordForEmail },
      } as unknown as ReturnType<typeof createClient>);
      render(<Harness openCount={1} />);
      fireEvent.click(screen.getByTestId(`prime-otp-use-${project}`));
      const button = screen.getByTestId<HTMLButtonElement>(
        'prime-otp-reset-password',
      );
      fireEvent.click(button);
      fireEvent.click(button);
      expect(createClient).not.toHaveBeenCalled();
      expect(button.disabled).toBe(true);
      const requestId = screen
        .getByTestId('reset-password-captcha')
        .getAttribute('data-request-id');
      await act(async () =>
        fireEvent.click(screen.getByText('Complete reset CAPTCHA')),
      );
      expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
      expect(resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        captchaToken: `token-${requestId}`,
      });
      expect(createClient).toHaveBeenCalledWith(
        PROJECT_URLS[project],
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false,
            autoRefreshToken: false,
            flowType: 'pkce',
          }),
        }),
      );
      expect(Toast.success).toHaveBeenCalledWith({
        title: 'Password reset request accepted.',
      });
      expect(mockSendCode).not.toHaveBeenCalled();
      expect(mockLoginWithCode).not.toHaveBeenCalled();
      expect(button.disabled).toBe(false);
    },
  );

  test('reset password without CAPTCHA exposes relay rejection and allows retry', async () => {
    const resetPasswordForEmail = jest
      .fn()
      .mockResolvedValue({ error: new Error('Relay route is not allowed') });
    jest.mocked(createClient).mockReturnValue({
      auth: { resetPasswordForEmail },
    } as unknown as ReturnType<typeof createClient>);
    render(<Harness openCount={1} />);
    fireEvent.click(screen.getByTestId('prime-otp-use-test-2'));
    fireEvent.click(screen.getByTestId('prime-otp-client-captcha'));
    await act(async () =>
      fireEvent.click(screen.getByTestId('prime-otp-reset-password')),
    );
    expect(screen.queryByTestId('reset-password-captcha')).toBeNull();
    expect(resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {});
    expect(Toast.error).toHaveBeenCalledWith({
      title: 'Relay route is not allowed',
    });
    expect(Toast.success).not.toHaveBeenCalled();
    expect(
      screen.getByTestId<HTMLButtonElement>('prime-otp-reset-password')
        .disabled,
    ).toBe(false);
  });

  test('reset CAPTCHA load failure retries with a new token before calling the API', async () => {
    const resetPasswordForEmail = jest.fn().mockResolvedValue({ error: null });
    jest.mocked(createClient).mockReturnValue({
      auth: { resetPasswordForEmail },
    } as unknown as ReturnType<typeof createClient>);
    render(<Harness openCount={1} />);
    fireEvent.click(screen.getByTestId('prime-otp-reset-password'));
    const first = screen
      .getByTestId('reset-password-captcha')
      .getAttribute('data-request-id');
    await act(async () =>
      fireEvent.click(screen.getByText('Fail reset CAPTCHA')),
    );
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('prime-otp-reset-password-retry'));
    const second = screen
      .getByTestId('reset-password-captcha')
      .getAttribute('data-request-id');
    expect(second).not.toBe(first);
    await act(async () =>
      fireEvent.click(screen.getByText('Complete reset CAPTCHA')),
    );
    expect(resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      captchaToken: `token-${second}`,
    });
  });

  test.each(['close panel', 'disable developer mode', 'change email'])(
    '%s cancels a pending reset CAPTCHA without making an API request',
    async (scenario) => {
      const { rerender } = render(<Harness openCount={1} />);
      fireEvent.click(screen.getByTestId('prime-otp-reset-password'));
      expect(screen.getByTestId('reset-password-captcha')).toBeTruthy();
      await act(async () => {
        if (scenario === 'close panel')
          fireEvent.click(screen.getByTestId('prime-otp-close-dev-controls'));
        else if (scenario === 'disable developer mode') {
          mockDevSettingsEnabled = false;
          rerender(<Harness openCount={1} />);
        } else rerender(<Harness openCount={1} email="changed@example.com" />);
      });
      expect(screen.queryByTestId('reset-password-captcha')).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
      expect(Toast.error).not.toHaveBeenCalled();
      expect(Toast.success).not.toHaveBeenCalled();
    },
  );

  test.each(['invalid email', 'another auth action'])(
    '%s prevents reset password requests',
    (scenario) => {
      render(
        <Harness
          openCount={1}
          email={scenario === 'invalid email' ? '' : 'test@example.com'}
          authActionPending={scenario === 'another auth action'}
        />,
      );
      expect(
        screen.getByTestId<HTMLButtonElement>('prime-otp-reset-password')
          .disabled,
      ).toBe(true);
      fireEvent.click(screen.getByTestId('prime-otp-reset-password'));
      expect(screen.queryByTestId('reset-password-captcha')).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    },
  );
});
