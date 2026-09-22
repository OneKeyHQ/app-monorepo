/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, renderHook } from '@testing-library/react';

import {
  HomeHeaderContainer,
  useHomeHeaderLayout,
} from './HomeHeaderContainer';

let mockOnLayout:
  | ((event: { nativeEvent: { layout: { height: number } } }) => void)
  | undefined;

jest.mock('@onekeyhq/components', () => ({
  YStack: ({ onLayout }: { onLayout: typeof mockOnLayout }) => {
    mockOnLayout = onLayout;
    return null;
  },
  Stack: () => null,
  HeaderScrollGestureWrapper: () => null,
}));
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 400, fontScale: 1 }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { account: { wallet: { homePageViewed: jest.fn() } } },
}));
jest.mock('../../../hooks/useHomeBalanceState', () => ({
  useHomeBalanceState: () => 'unknown',
}));
jest.mock('../../../states/jotai/contexts/accountOverview', () => ({
  useWalletTopBannersAtom: () => [{ banners: [] }],
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
}));
jest.mock(
  '../components/HomeTokenListProvider/HomeTokenListProviderMirror',
  () => ({
    HomeTokenListProviderMirror: ({ children }: { children: ReactNode }) =>
      children,
  }),
);
jest.mock('../components/PullToRefresh', () => ({
  onHomePageRefresh: jest.fn(),
}));
jest.mock('../components/WalletActions', () => ({ WalletActions: () => null }));
jest.mock('../components/WalletBanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./HomeOverviewContainer', () => ({
  HomeOverviewContainer: () => null,
}));

it('notifies scroll consumers on the first header measurement and subsequent height changes', () => {
  const { result } = renderHook(() => useHomeHeaderLayout());
  render(<HomeHeaderContainer />);
  expect(result.current.measuredHeight).toBeUndefined();
  act(() => mockOnLayout?.({ nativeEvent: { layout: { height: 182 } } }));
  expect(result.current.measuredHeight).toBe(182);
  act(() => mockOnLayout?.({ nativeEvent: { layout: { height: 210 } } }));
  expect(result.current.measuredHeight).toBe(210);
});
