/** @jest-environment jsdom */

import { forwardRef, useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OuterTabPagerView } from './OuterTabPagerView';

let mockPageStateChange:
  | ((state: 'dragging' | 'settling' | 'idle') => void)
  | undefined;
let mockPageSelected: ((position: number) => void) | undefined;
const mockPlatformEnv = platformEnv;

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: object) => styles },
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('react-native-pager-view', () => ({
  __esModule: true,
  default: forwardRef(function MockPager(
    {
      children,
      onPageScrollStateChanged,
      onPageSelected,
    }: PropsWithChildren<{
      onPageScrollStateChanged: (event: {
        nativeEvent: { pageScrollState: string };
      }) => void;
      onPageSelected: (event: { nativeEvent: { position: number } }) => void;
    }>,
    _ref,
  ) {
    mockPageStateChange = (state) =>
      onPageScrollStateChanged({ nativeEvent: { pageScrollState: state } });
    mockPageSelected = (position) =>
      onPageSelected({ nativeEvent: { position } });
    return <div>{children}</div>;
  }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useAnimatedRef: () => ({ current: null }),
  useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
  useEvent: () => () => undefined,
  runOnJS: (callback: unknown) => callback,
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({ isNativeIOS: true }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceSetting: { setSelectedBrowserTab: jest.fn() } },
}));

beforeEach(() => {
  mockPlatformEnv.isNativeIOS = true;
});

function EarnActivityProbe({
  active,
  onQuery,
  onCleanup,
  accountListeners,
}: {
  active: boolean;
  onQuery: () => void;
  onCleanup: () => void;
  accountListeners: Set<() => void>;
}) {
  useEffect(() => {
    if (!active) return undefined;
    const interval = setInterval(onQuery, 180_000);
    accountListeners.add(onQuery);
    return () => {
      clearInterval(interval);
      accountListeners.delete(onQuery);
      onCleanup();
    };
  }, [active, onQuery, onCleanup, accountListeners]);
  return <span>Earn</span>;
}

it.each(['before', 'after'] as const)(
  'cleans up Earn activity when idle arrives %s the background tab update',
  (idleOrder) => {
    mockPlatformEnv.isNativeIOS = false;
    jest.useFakeTimers();
    const onQuery = jest.fn();
    const onCleanup = jest.fn();
    const accountListeners = new Set<() => void>();
    const content = (tab: ETranslations) => (
      <OuterTabPagerView
        selectedHeaderTab={tab}
        showDiscoveryPage
        earnContent={
          <EarnActivityProbe
            active={tab === ETranslations.global_earn}
            onQuery={onQuery}
            onCleanup={onCleanup}
            accountListeners={accountListeners}
          />
        }
        browserContent={<span>Browser</span>}
      />
    );
    const screen = render(content(ETranslations.global_earn));
    try {
      expect(accountListeners.size).toBe(1);
      act(() => mockPageStateChange?.('dragging'));
      act(() => mockPageSelected?.(1));
      act(() => mockPageStateChange?.('settling'));
      if (idleOrder === 'before') {
        act(() => mockPageStateChange?.('idle'));
      }

      // The bg atom arrives independently of the native pager's idle event.
      screen.rerender(content(ETranslations.global_browser));
      if (idleOrder === 'after') {
        act(() => mockPageStateChange?.('idle'));
      }
      expect(onCleanup).toHaveBeenCalledTimes(1);
      expect(accountListeners.size).toBe(0);
      act(() => {
        jest.advanceTimersByTime(180_000);
        accountListeners.forEach((listener) => listener());
      });
      expect(onQuery).not.toHaveBeenCalled();

      act(() => mockPageStateChange?.('dragging'));
      act(() => mockPageSelected?.(0));
      act(() => mockPageStateChange?.('idle'));
      screen.rerender(content(ETranslations.global_earn));
      expect(accountListeners.size).toBe(1);
      act(() => {
        jest.advanceTimersByTime(180_000);
        accountListeners.forEach((listener) => listener());
      });
      expect(onQuery).toHaveBeenCalledTimes(2);
    } finally {
      screen.unmount();
      jest.useRealTimers();
    }
  },
);

it('keeps Earn activity running when the native drag is canceled', () => {
  mockPlatformEnv.isNativeIOS = false;
  const onQuery = jest.fn();
  const onCleanup = jest.fn();
  const accountListeners = new Set<() => void>();
  const screen = render(
    <OuterTabPagerView
      selectedHeaderTab={ETranslations.global_earn}
      showDiscoveryPage
      earnContent={
        <EarnActivityProbe
          active
          onQuery={onQuery}
          onCleanup={onCleanup}
          accountListeners={accountListeners}
        />
      }
      browserContent={<span>Browser</span>}
    />,
  );
  act(() => mockPageStateChange?.('dragging'));
  act(() => mockPageStateChange?.('settling'));
  act(() => mockPageStateChange?.('idle'));
  expect(onCleanup).not.toHaveBeenCalled();
  expect(accountListeners.size).toBe(1);
  accountListeners.forEach((listener) => listener());
  expect(onQuery).toHaveBeenCalledTimes(1);
  screen.unmount();
});

it('reports the outer drag and settling as one transition until idle', () => {
  const onTransitioningChange = jest.fn();
  render(
    <OuterTabPagerView
      selectedHeaderTab={ETranslations.global_earn}
      showDiscoveryPage
      earnContent={<span>Earn</span>}
      browserContent={<span>Browser</span>}
      onTransitioningChange={onTransitioningChange}
    />,
  );

  act(() => mockPageStateChange?.('dragging'));
  act(() => mockPageStateChange?.('settling'));
  expect(onTransitioningChange.mock.calls).toEqual([[true]]);
  act(() => mockPageStateChange?.('idle'));
  expect(onTransitioningChange.mock.calls).toEqual([[true], [false]]);
});

it('clears the parent transition state if the pager unmounts while dragging', () => {
  const onTransitioningChange = jest.fn();
  const { unmount } = render(
    <OuterTabPagerView
      selectedHeaderTab={ETranslations.global_earn}
      showDiscoveryPage
      earnContent={<span>Earn</span>}
      browserContent={<span>Browser</span>}
      onTransitioningChange={onTransitioningChange}
    />,
  );
  act(() => mockPageStateChange?.('dragging'));
  unmount();
  expect(onTransitioningChange.mock.calls).toEqual([[true], [false]]);
});
