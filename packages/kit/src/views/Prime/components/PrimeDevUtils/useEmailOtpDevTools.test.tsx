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

import { useEmailOtpDevTools } from './useEmailOtpDevTools';

let mockDevSettingsEnabled = true;
let mockTestEndpointEnabled = false;
const mockSendCode = jest.fn();
const mockLoginWithCode = jest.fn();
const mockPasswordSuccess = jest.fn();
const mockPasswordFailure = jest.fn();

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
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    variant?: string;
  }) => (
    <button
      data-testid={testID}
      data-variant={variant}
      onClick={onPress}
      type="button"
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
jest.mock('@onekeyhq/kit/src/hooks/useIsMounted', () => ({
  useIsMounted: () => ({ current: true }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false },
}));
jest.mock('@onekeyhq/shared/src/consts/authConsts', () => ({
  SUPABASE_PROJECT_URL: 'https://production.supabase.co',
  SUPABASE_PUBLIC_API_KEY: 'sb_publishable_fixture_production',
  ONEKEY_ID_AUTH_CONFIG: {
    prod: {
      projectUrl: 'https://production.supabase.co',
      publicKey: 'sb_publishable_fixture_production',
      captcha: { enabled: true, pageUrl: 'https://login.onekey.so/captcha' },
    },
    test: {
      projectUrl: 'https://test-2.supabase.co',
      publicKey: 'sb_publishable_fixture_test_2',
      captcha: {
        enabled: true,
        pageUrl: 'https://login.onekeytest.com/captcha',
      },
    },
  },
}));
jest.mock(
  '@onekeyhq/kit/src/components/Captcha/dev/emailOtpTestConfig',
  () => ({
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
        projectUrl: 'https://test-2.supabase.co',
        publicKey: 'sb_publishable_fixture_test_2',
      },
    ],
  }),
);

function Harness({ openCount }: { openCount: number }) {
  const devAuth = useEmailOtpDevTools({
    openCount,
    sendCode: mockSendCode,
    loginWithCode: mockLoginWithCode,
  });
  return (
    <>
      {devAuth.renderControls()}
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

  test.each(['production', 'test', 'test-2'])(
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
        `https://${project}.supabase.co`,
        expect.any(String),
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
          url: 'https://test-2.supabase.co',
          key: 'sb_publishable_fixture_test_2',
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
    ).toBe('https://test-2.supabase.co');
    expect(screen.getByTestId('prime-otp-captcha-page-url').textContent).toBe(
      'https://login.onekeytest.com/captcha',
    );
    expect(screen.getByTestId('captcha-override').textContent).toBe('true');
  });

  test('production debug selection on the test node uses an isolated production client', async () => {
    mockTestEndpointEnabled = true;
    render(<Harness openCount={1} />);
    fireEvent.click(screen.getByTestId('prime-otp-use-production'));
    await act(async () => fireEvent.click(screen.getByText('Send test code')));
    expect(createClient).toHaveBeenCalledWith(
      'https://production.supabase.co',
      'sb_publishable_fixture_production',
      expect.anything(),
    );
    expect(mockSendCode).not.toHaveBeenCalled();
    expect(screen.getByTestId('test-project-active').textContent).toBe('true');
  });
});
