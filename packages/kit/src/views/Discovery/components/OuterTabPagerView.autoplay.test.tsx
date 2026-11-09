/** @jest-environment jsdom */

import { forwardRef } from 'react';
import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { OuterTabPagerView } from './OuterTabPagerView';

let mockPageStateChange:
  | ((state: 'dragging' | 'settling' | 'idle') => void)
  | undefined;

jest.mock('react-freeze', () => ({
  Freeze: ({ children }: PropsWithChildren) => children,
}));
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
    }: PropsWithChildren<{
      onPageScrollStateChanged: (event: {
        nativeEvent: { pageScrollState: string };
      }) => void;
    }>,
    _ref,
  ) {
    mockPageStateChange = (state) =>
      onPageScrollStateChanged({ nativeEvent: { pageScrollState: state } });
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
