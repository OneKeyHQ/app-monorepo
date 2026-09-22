/** @jest-environment jsdom */

import { type ReactNode, StrictMode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PrimeLoginPasswordTestDialog } from './PrimeLoginPasswordTestDialog';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Stack: Container,
    XStack: Container,
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" disabled={disabled} onClick={onPress}>
        {children}
      </button>
    ),
    Input: ({
      value,
      onChangeText,
      testID,
      disabled,
      secureTextEntry,
      keyboardType,
      autoFocus,
    }: {
      value: string;
      onChangeText: (value: string) => void;
      testID: string;
      disabled: boolean;
      secureTextEntry: boolean;
      keyboardType: string;
      autoFocus: boolean;
    }) => (
      <input
        autoFocus={autoFocus}
        type={secureTextEntry ? 'password' : 'text'}
        data-testid={testID}
        data-keyboard-type={keyboardType}
        value={value}
        disabled={disabled}
        onChange={(event) => onChangeText(event.target.value)}
      />
    ),
    Alert: ({
      description,
      action,
    }: {
      description: string;
      action: {
        primary: string;
        isPrimaryDisabled: boolean;
        onPrimaryPress: () => void;
      };
    }) => (
      <div>
        {description}
        <button
          type="button"
          disabled={action.isPrimaryDisabled}
          onClick={action.onPrimaryPress}
        >
          {action.primary}
        </button>
      </div>
    ),
    Dialog: {
      Header: Container,
      Title: Container,
      Description: Container,
      Icon: () => null,
      Footer: ({
        confirmButtonProps,
        onConfirm,
        extraContent,
      }: {
        confirmButtonProps: { disabled: boolean };
        onConfirm: (args: { preventClose: () => void }) => void;
        extraContent: ReactNode;
      }) => (
        <>
          <button
            type="button"
            disabled={confirmButtonProps.disabled}
            onClick={() => onConfirm({ preventClose: jest.fn() })}
          >
            Submit
          </button>
          {extraContent}
        </>
      ),
    },
    Toast: { error: jest.fn() },
  };
});

jest.mock('@onekeyhq/kit/src/components/Captcha/CaptchaFrame', () => ({
  __esModule: true,
  default: ({
    requestId,
    onResult,
  }: import('@onekeyhq/kit/src/components/Captcha/captchaMessage').ICaptchaFrameProps) => (
    <div data-testid="password-captcha" data-request-id={requestId}>
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
        Complete CAPTCHA
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
        Fail CAPTCHA load
      </button>
    </div>
  ),
}));

function makeProps() {
  return {
    active: true,
    email: 'test@example.com',
    captchaConfig: {
      enabled: true,
      pageUrl: 'https://captcha.example.com/captcha',
    },
    revision: 0,
    disabled: false,
    loginWithPassword: jest
      .fn<
        Promise<void>,
        [{ email: string; password: string; captchaToken?: string }]
      >()
      .mockResolvedValue(undefined),
    onLoginSuccess: jest.fn(),
    onChooseAnotherSignInMethod: jest.fn(),
    developmentControls: jest.fn(() => null),
  };
}

function enterPassword(value = ' Abc!中文🔐 01 ') {
  const input = screen.getByTestId<HTMLInputElement>('prime-otp-code');
  fireEvent.change(input, { target: { value } });
  return input;
}

describe('password test login with CAPTCHA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('preserves any characters, waits for CAPTCHA, and submits once', async () => {
    const props = makeProps();
    render(
      <StrictMode>
        <PrimeLoginPasswordTestDialog {...props} />
      </StrictMode>,
    );
    const submit = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Submit',
    });
    expect(submit.disabled).toBe(true);
    expect(screen.queryByTestId('password-captcha')).toBeNull();
    expect(props.loginWithPassword).not.toHaveBeenCalled();
    const input = enterPassword();
    expect(input.type).toBe('password');
    expect(input.getAttribute('data-keyboard-type')).toBe('default');
    expect(input.hasAttribute('maxlength')).toBe(false);
    expect(input.value).toBe(' Abc!中文🔐 01 ');
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(props.loginWithPassword).not.toHaveBeenCalled();
    const requestId = screen
      .getByTestId('password-captcha')
      .getAttribute('data-request-id');
    fireEvent.click(screen.getByText('Complete CAPTCHA'));
    await waitFor(() => expect(props.onLoginSuccess).toHaveBeenCalledTimes(1));
    expect(props.loginWithPassword).toHaveBeenCalledTimes(1);
    expect(props.loginWithPassword).toHaveBeenCalledWith({
      email: props.email,
      password: ' Abc!中文🔐 01 ',
      captchaToken: `token-${requestId}`,
    });
    expect(input.value).toBe('');
    expect(submit.disabled).toBe(true);
  });

  test('rejected credentials retain input and a retry obtains a fresh CAPTCHA token', async () => {
    const props = makeProps();
    props.loginWithPassword.mockRejectedValueOnce(
      new Error('Invalid login credentials'),
    );
    render(<PrimeLoginPasswordTestDialog {...props} />);
    const input = enterPassword();
    fireEvent.click(screen.getByText('Submit'));
    const first = screen
      .getByTestId('password-captcha')
      .getAttribute('data-request-id');
    fireEvent.click(screen.getByText('Complete CAPTCHA'));
    await waitFor(() =>
      expect(Toast.error).toHaveBeenCalledWith({
        title: 'Invalid login credentials',
      }),
    );
    expect(input.value).toBe(' Abc!中文🔐 01 ');
    expect(input.disabled).toBe(false);
    expect(props.onLoginSuccess).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Submit'));
    const second = screen
      .getByTestId('password-captcha')
      .getAttribute('data-request-id');
    expect(second).not.toBe(first);
    fireEvent.click(screen.getByText('Complete CAPTCHA'));
    await waitFor(() => expect(props.onLoginSuccess).toHaveBeenCalledTimes(1));
    expect(
      props.loginWithPassword.mock.calls.map(([args]) => args.captchaToken),
    ).toEqual([`token-${first}`, `token-${second}`]);
  });

  test('HTML load failure permits retry without requesting password authentication', async () => {
    const props = makeProps();
    render(<PrimeLoginPasswordTestDialog {...props} />);
    enterPassword();
    fireEvent.click(screen.getByText('Submit'));
    fireEvent.click(screen.getByText('Fail CAPTCHA load'));
    await waitFor(() => expect(Toast.error).toHaveBeenCalled());
    expect(props.loginWithPassword).not.toHaveBeenCalled();
    expect(screen.queryByTestId('password-captcha')).toBeNull();
    fireEvent.click(screen.getByText(ETranslations.global_retry));
    fireEvent.click(screen.getByText('Complete CAPTCHA'));
    await waitFor(() =>
      expect(props.loginWithPassword).toHaveBeenCalledTimes(1),
    );
  });

  test('CAPTCHA off directly submits the unchanged password without a token', async () => {
    const props = makeProps();
    props.captchaConfig.enabled = false;
    render(<PrimeLoginPasswordTestDialog {...props} />);
    enterPassword(' spaces stay ! ');
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(props.onLoginSuccess).toHaveBeenCalledTimes(1));
    expect(props.loginWithPassword).toHaveBeenCalledWith({
      email: props.email,
      password: ' spaces stay ! ',
    });
    expect(screen.queryByTestId('password-captcha')).toBeNull();
  });

  test('changing test configuration cancels pending CAPTCHA and clears the password', async () => {
    const props = makeProps();
    const { rerender } = render(<PrimeLoginPasswordTestDialog {...props} />);
    enterPassword();
    fireEvent.click(screen.getByText('Submit'));
    rerender(<PrimeLoginPasswordTestDialog {...props} revision={1} />);
    await act(async () => {});
    expect(props.loginWithPassword).not.toHaveBeenCalled();
    expect(screen.queryByTestId('password-captcha')).toBeNull();
    expect(screen.getByTestId<HTMLInputElement>('prime-otp-code').value).toBe(
      '',
    );
    expect(Toast.error).not.toHaveBeenCalled();
  });

  test('leaving password mode cancels pending CAPTCHA without sending credentials', async () => {
    const props = makeProps();
    const { unmount } = render(<PrimeLoginPasswordTestDialog {...props} />);
    enterPassword();
    fireEvent.click(screen.getByText('Submit'));
    unmount();
    await act(async () => {});
    expect(props.loginWithPassword).not.toHaveBeenCalled();
    expect(Toast.error).not.toHaveBeenCalled();
  });
});
