/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { createClient } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { useEmailOtpDevTools } from './useEmailOtpDevTools';

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
    Switch: () => null,
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
}));
jest.mock(
  '@onekeyhq/kit/src/components/Captcha/dev/emailOtpTestConfig',
  () => ({
    EMAIL_OTP_CAPTCHA_PAGE_URLS: {
      local: 'http://localhost:8800/captcha',
      test: 'https://login.onekeytest.com/captcha',
      production: 'https://login.onekey.so/captcha',
    },
    EMAIL_OTP_TEST_CONFIG: {
      projectUrl: 'https://test.supabase.co',
      publicKey: 'sb_publishable_fixture_test',
      pageUrl: 'https://captcha.example.com',
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
    sendCode: jest.fn(),
    loginWithCode: jest.fn(),
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
      <span data-testid="test-project-active">
        {String(devAuth.isTestProject)}
      </span>
    </>
  );
}

describe('email OTP debug panel without a development build', () => {
  beforeEach(() => jest.clearAllMocks());

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
});
