/** @jest-environment jsdom */

import type { ComponentType, ReactElement, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TranslatePopoverTrigger } from './usePageTranslation';

let mockPrimeSubscriptionActive = false;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'zh-CN',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isLoggedIn: true,
    isPrimeSubscriptionActive: mockPrimeSubscriptionActive,
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { servicePrimeFreeTrial: { refreshQuota: jest.fn() } },
}));
jest.mock('@onekeyhq/kit/src/views/Prime/hooks/usePrimeFeatureAccess', () => ({
  isPrimeFreeTrialTravelMode: () => false,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Prime/components/PrimeFreeTrialRemainingHint',
  () => ({
    PrimeFreeTrialRemainingHint: () => null,
  }),
);
jest.mock('@onekeyhq/kit/src/components/WebView/useWebViewTranslate', () => ({
  useWebViewTranslate: jest.fn(),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useTranslateSettingsPersistAtom: () => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    return useState({
      engine: 'ai',
      displayMode: 'replace',
      targetLanguage: 'auto',
    });
  },
}));
jest.mock('./useWebTabs', () => ({}));
jest.mock('@onekeyhq/components', () => {
  const closePopover = jest.fn();
  const Stack = ({
    children,
    testID,
    pt,
  }: {
    children?: ReactNode;
    testID?: string;
    pt?: string;
  }) => (
    <div data-testid={testID} data-padding-top={pt}>
      {children}
    </div>
  );
  const Badge = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    usePopoverContext: () => ({ closePopover }),
    YStack: Stack,
    XStack: Stack,
    Stack,
    SizableText: Stack,
    Badge: Object.assign(Badge, { Text: Stack }),
    Button: ({
      children,
      onPress,
      iconAfter,
      testID,
    }: {
      children?: ReactNode;
      onPress: () => void;
      iconAfter?: string;
      testID?: string;
    }) => (
      <button
        data-testid={testID}
        data-icon-after={iconAfter}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    IconButton: ({
      onPress,
      testID,
    }: {
      onPress?: () => void;
      testID?: string;
    }) => <button aria-label={testID} data-testid={testID} onClick={onPress} />,
    SegmentControl: ({
      options,
      onChange,
    }: {
      options: { value: string }[];
      onChange: (v: string) => void;
    }) => (
      <>
        {options.map(({ value }) => (
          <button key={value} onClick={() => onChange(value)}>
            {value}
          </button>
        ))}
      </>
    ),
    Select: ({
      open,
      onOpenChange,
    }: {
      open: boolean;
      onOpenChange: (v: boolean) => void;
    }) => (
      <>
        <button onClick={() => onOpenChange(true)}>languages</button>
        {open ? <div data-testid="language-list" /> : null}
      </>
    ),
    // Popover deliberately treats function content as a component type, just
    // like the real native and desktop implementations.
    Popover: ({
      renderContent,
    }: {
      renderContent: ComponentType<{ closePopover: () => void }> | ReactElement;
    }) => {
      if (typeof renderContent === 'function') {
        const Content = renderContent;
        return <Content closePopover={closePopover} />;
      }
      return renderContent;
    },
  };
});

beforeEach(() => {
  mockPrimeSubscriptionActive = false;
  Object.assign(platformEnv, { isNative: false });
});

it.each([
  { isNative: true, paddingTop: '$2' },
  { isNative: false, paddingTop: '$5' },
])(
  'uses compact content top padding only on native: %j',
  ({ isNative, paddingTop }) => {
    Object.assign(platformEnv, { isNative });
    const props = { isTranslated: false, onTranslate: jest.fn(), open: true };
    render(<TranslatePopoverTrigger {...props} />);
    expect(
      screen.getByTestId('discovery-translate-content').dataset.paddingTop,
    ).toBe(paddingTop);
  },
);

it.each([
  {
    isNative: true,
    isPrime: false,
    isTranslated: false,
    icon: 'PrimeOutline',
    badge: false,
  },
  {
    isNative: true,
    isPrime: true,
    isTranslated: false,
    icon: undefined,
    badge: false,
  },
  {
    isNative: true,
    isPrime: false,
    isTranslated: true,
    icon: undefined,
    badge: false,
  },
  {
    isNative: false,
    isPrime: false,
    isTranslated: false,
    icon: undefined,
    badge: true,
  },
])(
  'keeps the Prime indicator conditional and native-only: %j',
  ({ isNative, isPrime, isTranslated, icon, badge }) => {
    Object.assign(platformEnv, { isNative });
    mockPrimeSubscriptionActive = isPrime;
    const props = { isTranslated, onTranslate: jest.fn(), open: true };
    render(<TranslatePopoverTrigger {...props} />);
    expect(screen.getByTestId('discovery-btn').dataset.iconAfter).toBe(icon);
    expect(
      Boolean(screen.queryByTestId('discovery-translate-prime-badge')),
    ).toBe(badge);
  },
);

it('keeps the custom-language list open when a free-user quota refresh changes the translate callback', () => {
  const props = { isTranslated: false, onTranslate: jest.fn(), open: true };
  const { rerender } = render(<TranslatePopoverTrigger {...props} />);
  fireEvent.click(screen.getByTestId('discovery-icon-btn'));
  fireEvent.click(screen.getByText('custom'));
  fireEvent.click(screen.getByText('languages'));
  expect(screen.getByTestId('language-list')).toBeTruthy();
  act(() =>
    rerender(<TranslatePopoverTrigger {...props} onTranslate={jest.fn()} />),
  );
  expect(screen.getByTestId('language-list')).toBeTruthy();
});
