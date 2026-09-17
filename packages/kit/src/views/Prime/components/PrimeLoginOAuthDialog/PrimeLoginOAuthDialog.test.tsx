/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import PrimeLoginOAuthDialog from './PrimeLoginOAuthDialog';

const mockEmailDialogMount = jest.fn();
const mockEmailDialogUnmount = jest.fn();
let mockLastLoginMethod: string | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const AccordionContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({
    value: '',
    onValueChange: () => undefined,
  });
  const AccordionItemContext = React.createContext('');

  function Container({
    children,
    testID,
  }: {
    children?: import('react').ReactNode;
    testID?: string;
  }) {
    return React.createElement(
      'div',
      testID ? { 'data-testid': testID } : null,
      children,
    );
  }

  function Badge({ children }: { children?: import('react').ReactNode }) {
    return React.createElement('span', null, children);
  }
  Badge.Text = Container;

  function AccordionHeightAnimator({
    children,
  }: {
    children?: import('react').ReactNode;
  }) {
    const accordion = React.useContext(AccordionContext);
    const itemValue = React.useContext(AccordionItemContext);
    const open = accordion.value === itemValue;
    const [height, setHeight] = React.useState(0);
    const hasMeasured = React.useRef(false);

    React.useEffect(() => {
      if (!open) {
        setHeight(0);
      }
    }, [open]);

    // Tamagui measures force-mounted content after the closed-state effect.
    React.useEffect(() => {
      if (!hasMeasured.current) {
        hasMeasured.current = true;
        setHeight(240);
      }
    }, []);

    return React.createElement(
      'div',
      {
        'data-height': String(height),
        'data-testid': 'prime-login-more-methods-height-transition',
      },
      children,
    );
  }

  function HeightTransition({
    children,
    hide,
  }: {
    children?: import('react').ReactNode;
    hide?: boolean;
  }) {
    return React.createElement(
      'div',
      {
        'data-height': hide ? '0' : '240',
        'data-testid': 'prime-login-more-methods-height-transition',
      },
      children,
    );
  }

  function AccordionRoot({
    children,
    value,
    onValueChange,
  }: {
    children?: import('react').ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) {
    return React.createElement(
      AccordionContext.Provider,
      { value: { value, onValueChange } },
      children,
    );
  }

  function AccordionItem({
    children,
    value,
  }: {
    children?: import('react').ReactNode;
    value: string;
  }) {
    return React.createElement(
      AccordionItemContext.Provider,
      { value },
      children,
    );
  }

  function AccordionTrigger({
    children,
    disabled,
    testID,
  }: {
    children?:
      | import('react').ReactNode
      | ((state: { open: boolean }) => import('react').ReactNode);
    disabled?: boolean;
    testID?: string;
  }) {
    const accordion = React.useContext(AccordionContext);
    const itemValue = React.useContext(AccordionItemContext);
    const open = accordion.value === itemValue;

    return React.createElement(
      'button',
      {
        'data-testid': testID,
        disabled,
        onClick: () => accordion.onValueChange(open ? '' : itemValue),
        type: 'button',
      },
      typeof children === 'function' ? children({ open }) : children,
    );
  }

  function AccordionContent({
    children,
    forceMount,
    inert,
    pointerEvents,
    testID,
    accessibilityElementsHidden,
    importantForAccessibility,
    'aria-hidden': ariaHidden,
  }: {
    children?: import('react').ReactNode;
    forceMount?: boolean;
    inert?: boolean;
    pointerEvents?: 'auto' | 'none';
    testID?: string;
    accessibilityElementsHidden?: boolean;
    importantForAccessibility?: string;
    'aria-hidden'?: boolean;
  }) {
    const accordion = React.useContext(AccordionContext);
    const itemValue = React.useContext(AccordionItemContext);
    const open = accordion.value === itemValue;

    if (!forceMount && !open) {
      return null;
    }

    return React.createElement(
      'div',
      {
        'aria-hidden': ariaHidden,
        'data-accessibility-elements-hidden': String(
          accessibilityElementsHidden,
        ),
        'data-important-for-accessibility': importantForAccessibility,
        'data-inert': String(inert),
        'data-pointer-events': pointerEvents,
        'data-testid': testID,
      },
      children,
    );
  }

  const Accordion = Object.assign(AccordionRoot, {
    Content: AccordionContent,
    HeightAnimator: AccordionHeightAnimator,
    Item: AccordionItem,
    Trigger: AccordionTrigger,
  });

  return {
    Accordion,
    Badge,
    Button: ({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: import('react').ReactNode;
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
    Dialog: {
      Description: Container,
      Footer: () => null,
      Header: Container,
      Icon: () => null,
      Title: Container,
    },
    HeightTransition,
    Icon: () => null,
    SizableText: Container,
    Stack: Container,
    Toast: {
      error: jest.fn(),
    },
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  useOneKeyIdLastLoginMethodPersistAtom: () => [
    { method: mockLastLoginMethod },
  ],
}));

jest.mock(
  '@onekeyhq/kit-bg/src/states/jotai/atoms/oneKeyIdLastLoginMethod',
  () => ({
    persistOneKeyIdLastLoginMethod: jest.fn(async () => true),
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const servicePrime = {
    apiOAuthLogin: jest.fn(),
  };
  return {
    __esModule: true,
    __servicePrime: servicePrime,
    default: { servicePrime },
  };
});

jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab',
  () => ({
    redirectOneKeyIdAuthToExtExpandTab: jest.fn(),
    shouldRunOneKeyIdAuthInExtExpandTab: () => false,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow',
  () => ({
    useIdentityExitFlow: () => ({ run: jest.fn() }),
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const platformEnv = {
    isNative: false,
    isNativeIOS: false,
  };
  return {
    __esModule: true,
    __platformEnv: platformEnv,
    default: platformEnv,
  };
});

jest.mock('../oneKeyIdLoginToastUtils', () => ({
  getSanitizedAuthErrorText: jest.fn(),
  scrubSensitiveErrorMessageText: jest.fn(),
  showOneKeyIdLoginFailedToast: jest.fn(),
  showOneKeyIdLoginSuccessToast: jest.fn(),
  throwLocalizedOneKeyIdLoginError: jest.fn(),
}));

jest.mock('../PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2', () => {
  const React = jest.requireActual('react') as typeof import('react');

  function MockPrimeLoginEmailDialog({
    showLastUsedBadge,
  }: {
    showLastUsedBadge?: boolean;
  }) {
    React.useEffect(() => {
      mockEmailDialogMount();
      return () => {
        mockEmailDialogUnmount();
      };
    }, []);
    return React.createElement(
      'div',
      {
        'data-show-last-used-badge': String(Boolean(showLastUsedBadge)),
        'data-testid': 'mock-prime-login-email-dialog',
      },
      showLastUsedBadge
        ? React.createElement('span', {
            'data-testid': 'prime-login-last-used-badge-email',
          })
        : null,
    );
  }

  return {
    __esModule: true,
    default: MockPrimeLoginEmailDialog,
  };
});

jest.mock('../useOneKeyIdLocalKeylessOAuth', () => {
  let onAccountMismatch: (() => void) | undefined;
  const oauthMocks = {
    getFreshOAuthTokensForRegularLogin: jest.fn(),
    getOAuthAccessToken: jest.fn(),
    rollbackProvisionalOAuthSession: jest.fn(),
    triggerAccountMismatch: () => onAccountMismatch?.(),
  };
  return {
    __oauthMocks: oauthMocks,
    useOneKeyIdLocalKeylessOAuth: (options: {
      onAccountMismatch?: () => void;
    }) => {
      onAccountMismatch = options.onAccountMismatch;
      return {
        ...oauthMocks,
        isLocalKeylessOAuthMode: false,
        localKeylessProvider: undefined,
        localKeylessProviderName: '',
        localKeylessWalletId: undefined,
      };
    },
  };
});

function getPlatformEnvMock() {
  return jest.requireMock('@onekeyhq/shared/src/platformEnv').__platformEnv as {
    isNative: boolean;
    isNativeIOS: boolean;
  };
}

function getOAuthMocks() {
  return jest.requireMock('../useOneKeyIdLocalKeylessOAuth').__oauthMocks as {
    getOAuthAccessToken: jest.Mock;
    triggerAccountMismatch: () => void;
  };
}

function getPersistOneKeyIdLastLoginMethodMock() {
  return jest.requireMock(
    '@onekeyhq/kit-bg/src/states/jotai/atoms/oneKeyIdLastLoginMethod',
  ).persistOneKeyIdLastLoginMethod as jest.Mock;
}

function getBackgroundApiMocks() {
  return jest.requireMock(
    '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  ).__servicePrime as {
    apiOAuthLogin: jest.Mock;
  };
}

describe('PrimeLoginOAuthDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastLoginMethod = undefined;
    getPersistOneKeyIdLastLoginMethodMock().mockResolvedValue(true);
    const platformEnv = getPlatformEnvMock();
    platformEnv.isNative = false;
    platformEnv.isNativeIOS = false;
    getOAuthMocks().getOAuthAccessToken.mockReset();
    getBackgroundApiMocks().apiOAuthLogin.mockReset();
  });

  test('completes native Google OAuth after closing the iOS dialog', async () => {
    const callOrder: string[] = [];
    const platformEnv = getPlatformEnvMock();
    const { getOAuthAccessToken } = getOAuthMocks();
    let finishClosingDialog!: () => void;
    const closingDialog = new Promise<void>((resolve) => {
      finishClosingDialog = resolve;
    });
    platformEnv.isNative = true;
    platformEnv.isNativeIOS = true;
    getOAuthAccessToken.mockImplementation(async () => {
      callOrder.push('launchOAuth');
      return {
        accessToken: 'access-token',
        didUseOAuthSignIn: true,
        rollbackHandle: undefined,
      };
    });
    getBackgroundApiMocks().apiOAuthLogin.mockImplementation(async () => {
      callOrder.push('apiLogin');
    });
    const onComplete = jest.fn(() => {
      callOrder.push('closeDialog');
      return closingDialog;
    });
    const onLoginSuccess = jest.fn(async () => {
      callOrder.push('loginSuccess');
    });
    const onReopenAfterOAuthFailure = jest.fn();

    render(
      <PrimeLoginOAuthDialog
        onComplete={onComplete}
        onLoginSuccess={onLoginSuccess}
        onReopenAfterOAuthFailure={onReopenAfterOAuthFailure}
      />,
    );
    fireEvent.click(screen.getByTestId('prime-login-oauth-google-btn'));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(getOAuthAccessToken).not.toHaveBeenCalled();

    await act(async () => {
      finishClosingDialog();
      await closingDialog;
    });
    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    });
    expect(callOrder).toEqual([
      'closeDialog',
      'launchOAuth',
      'apiLogin',
      'loginSuccess',
    ]);
    expect(onReopenAfterOAuthFailure).not.toHaveBeenCalled();
    expect(getPersistOneKeyIdLastLoginMethodMock()).toHaveBeenCalledTimes(1);
    expect(getPersistOneKeyIdLastLoginMethodMock()).toHaveBeenCalledWith(
      'google',
    );
  });

  test('reopens the iOS dialog with recovery after account mismatch', async () => {
    const platformEnv = getPlatformEnvMock();
    const oauthMocks = getOAuthMocks();
    platformEnv.isNative = true;
    platformEnv.isNativeIOS = true;
    oauthMocks.getOAuthAccessToken.mockImplementation(async () => {
      oauthMocks.triggerAccountMismatch();
      throw new OneKeyLocalError('Account mismatch');
    });
    const onComplete = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();
    const onReopenAfterOAuthFailure = jest.fn();

    render(
      <PrimeLoginOAuthDialog
        onComplete={onComplete}
        onCancel={onCancel}
        onReopenAfterOAuthFailure={onReopenAfterOAuthFailure}
      />,
    );
    fireEvent.click(screen.getByTestId('prime-login-oauth-google-btn'));

    await waitFor(() => {
      expect(onReopenAfterOAuthFailure).toHaveBeenCalledWith({
        showKeylessLogoutAction: true,
      });
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(getPersistOneKeyIdLastLoginMethodMock()).not.toHaveBeenCalled();
  });

  test('keeps the existing success-then-close order outside iOS', async () => {
    const callOrder: string[] = [];
    const { getOAuthAccessToken } = getOAuthMocks();
    getOAuthAccessToken.mockImplementation(async () => {
      callOrder.push('launchOAuth');
      return {
        accessToken: 'access-token',
        didUseOAuthSignIn: true,
        rollbackHandle: undefined,
      };
    });
    getBackgroundApiMocks().apiOAuthLogin.mockImplementation(async () => {
      callOrder.push('apiLogin');
    });
    const onComplete = jest.fn(async () => {
      callOrder.push('closeDialog');
    });
    const onLoginSuccess = jest.fn(async () => {
      callOrder.push('loginSuccess');
    });

    render(
      <PrimeLoginOAuthDialog
        onComplete={onComplete}
        onLoginSuccess={onLoginSuccess}
      />,
    );
    fireEvent.click(screen.getByTestId('prime-login-oauth-google-btn'));

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    });
    expect(callOrder).toEqual([
      'launchOAuth',
      'apiLogin',
      'closeDialog',
      'loginSuccess',
    ]);
    expect(getPersistOneKeyIdLastLoginMethodMock()).toHaveBeenCalledTimes(1);
    expect(getPersistOneKeyIdLastLoginMethodMock()).toHaveBeenCalledWith(
      'google',
    );
  });

  test('starts collapsed and can reopen without remounting the email flow', () => {
    render(
      <PrimeLoginOAuthDialog
        onComplete={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    const trigger = screen.getByTestId('prime-login-more-methods-trigger');
    const getContent = () =>
      screen.getByTestId('prime-login-more-methods-content');
    const getTransitionHeight = () =>
      screen
        .getByTestId('prime-login-more-methods-height-transition')
        .getAttribute('data-height');

    expect(mockEmailDialogMount).toHaveBeenCalledTimes(1);
    expect(mockEmailDialogUnmount).not.toHaveBeenCalled();
    expect(getTransitionHeight()).toBe('0');
    expect(getContent().getAttribute('aria-hidden')).toBe('true');
    expect(getContent().getAttribute('data-pointer-events')).toBe('none');
    expect(getContent().getAttribute('data-inert')).toBe('true');
    expect(
      getContent().getAttribute('data-accessibility-elements-hidden'),
    ).toBe('true');
    expect(getContent().getAttribute('data-important-for-accessibility')).toBe(
      'no-hide-descendants',
    );

    fireEvent.click(trigger);

    expect(getTransitionHeight()).toBe('240');
    expect(getContent().getAttribute('aria-hidden')).toBe('false');
    expect(getContent().getAttribute('data-pointer-events')).toBe('auto');
    expect(getContent().getAttribute('data-inert')).toBe('false');

    fireEvent.click(trigger);

    expect(getTransitionHeight()).toBe('0');
    expect(getContent().getAttribute('aria-hidden')).toBe('true');

    fireEvent.click(trigger);

    expect(getTransitionHeight()).toBe('240');
    expect(getContent().getAttribute('aria-hidden')).toBe('false');
    expect(mockEmailDialogMount).toHaveBeenCalledTimes(1);
    expect(mockEmailDialogUnmount).not.toHaveBeenCalled();
    expect(screen.getByTestId('mock-prime-login-email-dialog')).toBeTruthy();
    expect(
      screen.queryByTestId('prime-login-last-used-badge-google'),
    ).toBeNull();
    expect(
      screen.queryByTestId('prime-login-last-used-badge-apple'),
    ).toBeNull();
    expect(
      screen.queryByTestId('prime-login-last-used-badge-email'),
    ).toBeNull();
  });

  test('shows a last-used badge on Google when that method is stored', () => {
    mockLastLoginMethod = 'google';

    render(
      <PrimeLoginOAuthDialog
        onComplete={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByTestId('prime-login-last-used-badge-google'),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('prime-login-last-used-badge-apple'),
    ).toBeNull();
    expect(
      screen.queryByTestId('prime-login-last-used-badge-email'),
    ).toBeNull();
    expect(
      screen
        .getByTestId('prime-login-more-methods-height-transition')
        .getAttribute('data-height'),
    ).toBe('0');
  });

  test('shows a last-used badge on Apple when that method is stored', () => {
    mockLastLoginMethod = 'apple';

    render(
      <PrimeLoginOAuthDialog
        onComplete={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByTestId('prime-login-last-used-badge-apple'),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('prime-login-last-used-badge-google'),
    ).toBeNull();
  });

  test('opens email methods and shows the email badge when email was last used', () => {
    mockLastLoginMethod = 'email';

    render(
      <PrimeLoginOAuthDialog
        onComplete={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen
        .getByTestId('prime-login-more-methods-height-transition')
        .getAttribute('data-height'),
    ).toBe('240');
    expect(
      screen
        .getByTestId('prime-login-more-methods-content')
        .getAttribute('aria-hidden'),
    ).toBe('false');
    expect(
      screen
        .getByTestId('mock-prime-login-email-dialog')
        .getAttribute('data-show-last-used-badge'),
    ).toBe('true');
    expect(
      screen.getByTestId('prime-login-last-used-badge-email'),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('prime-login-last-used-badge-google'),
    ).toBeNull();
  });

  test('does not persist last login method when OAuth login fails', async () => {
    const { getOAuthAccessToken } = getOAuthMocks();
    getOAuthAccessToken.mockRejectedValueOnce(
      new OneKeyLocalError('OAuth failed'),
    );

    render(
      <PrimeLoginOAuthDialog
        onComplete={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.click(screen.getByTestId('prime-login-oauth-google-btn'));

    await waitFor(() => {
      expect(getOAuthAccessToken).toHaveBeenCalledTimes(1);
    });
    expect(getPersistOneKeyIdLastLoginMethodMock()).not.toHaveBeenCalled();
  });
});
