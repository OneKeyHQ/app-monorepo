/** @jest-environment jsdom */

import type { ComponentType, ReactElement, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { TranslatePopoverTrigger } from './usePageTranslation';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'zh-CN',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ isLoggedIn: true, isPrimeSubscriptionActive: false }),
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
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    usePopoverContext: () => ({ closePopover }),
    YStack: Stack,
    XStack: Stack,
    Stack,
    SizableText: Stack,
    Badge: Object.assign(Stack, { Text: Stack }),
    Button: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress: () => void;
    }) => <button onClick={onPress}>{children}</button>,
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
