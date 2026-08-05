/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import PrimeLoginOAuthDialog from './PrimeLoginOAuthDialog';

const mockEmailDialogMount = jest.fn();
const mockEmailDialogUnmount = jest.fn();

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

  function Container({ children }: { children?: import('react').ReactNode }) {
    return React.createElement('div', null, children);
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
    HeightAnimator: Container,
    Item: AccordionItem,
    Trigger: AccordionTrigger,
  });

  return {
    Accordion,
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
    Icon: () => null,
    SizableText: Container,
    Stack: Container,
    Toast: {
      error: jest.fn(),
    },
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

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

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('../oneKeyIdLoginToastUtils', () => ({
  getSanitizedAuthErrorText: jest.fn(),
  scrubSensitiveErrorMessageText: jest.fn(),
  showOneKeyIdLoginFailedToast: jest.fn(),
  showOneKeyIdLoginSuccessToast: jest.fn(),
  throwLocalizedOneKeyIdLoginError: jest.fn(),
}));

jest.mock('../PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2', () => {
  const React = jest.requireActual('react') as typeof import('react');

  function MockPrimeLoginEmailDialog() {
    React.useEffect(() => {
      mockEmailDialogMount();
      return () => {
        mockEmailDialogUnmount();
      };
    }, []);
    return React.createElement('div', {
      'data-testid': 'mock-prime-login-email-dialog',
    });
  }

  return {
    __esModule: true,
    default: MockPrimeLoginEmailDialog,
  };
});

jest.mock('../useOneKeyIdLocalKeylessOAuth', () => ({
  useOneKeyIdLocalKeylessOAuth: () => ({
    getFreshOAuthTokensForRegularLogin: jest.fn(),
    getOAuthAccessToken: jest.fn(),
    isLocalKeylessOAuthMode: false,
    localKeylessProvider: undefined,
    localKeylessProviderName: '',
    localKeylessWalletId: undefined,
    rollbackProvisionalOAuthSession: jest.fn(),
  }),
}));

describe('PrimeLoginOAuthDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps the embedded email flow mounted while sign-in methods are collapsed', () => {
    render(
      <PrimeLoginOAuthDialog
        onComplete={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    const trigger = screen.getByTestId('prime-login-more-methods-trigger');
    const getContent = () =>
      screen.getByTestId('prime-login-more-methods-content');

    expect(mockEmailDialogMount).toHaveBeenCalledTimes(1);
    expect(mockEmailDialogUnmount).not.toHaveBeenCalled();
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

    expect(getContent().getAttribute('aria-hidden')).toBe('false');
    expect(getContent().getAttribute('data-pointer-events')).toBe('auto');
    expect(getContent().getAttribute('data-inert')).toBe('false');

    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(mockEmailDialogMount).toHaveBeenCalledTimes(1);
    expect(mockEmailDialogUnmount).not.toHaveBeenCalled();
    expect(screen.getByTestId('mock-prime-login-email-dialog')).toBeTruthy();
  });
});
