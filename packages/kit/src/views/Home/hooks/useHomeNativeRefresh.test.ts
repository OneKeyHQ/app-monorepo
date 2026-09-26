import { act, renderHook } from '@testing-library/react-native';

import { onHomePageRefresh } from '../components/PullToRefresh';

import { useHomeNativeRefresh } from './useHomeNativeRefresh';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

jest.mock('@onekeyhq/components', () => ({
  Haptics: { impact: jest.fn() },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { account: { wallet: { walletPullToRefresh: jest.fn() } } },
}));
jest.mock('../components/PullToRefresh', () => ({
  onHomePageRefresh: jest.fn(),
}));

function scrollEvent(y: number, top = 230) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentInset: { top, bottom: 0, left: 0, right: 0 },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

describe('Home native pull-to-refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('does not mistake the expanded pager header inset for overscroll', () => {
    const { result } = renderHook(useHomeNativeRefresh);
    act(() => {
      result.current.onScrollBeginDrag();
      result.current.onScroll(scrollEvent(-230));
      result.current.onScrollEndDrag(scrollEvent(-230));
    });
    expect(onHomePageRefresh).not.toHaveBeenCalled();
  });

  it('keeps the deepest pull and deduplicates fallback with the native control', () => {
    const { result } = renderHook(useHomeNativeRefresh);
    act(() => {
      result.current.onScrollBeginDrag();
      result.current.onScroll(scrollEvent(-300));
      result.current.onScrollEndDrag(scrollEvent(-250));
      result.current.onRefresh();
    });
    expect(onHomePageRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);
    act(() => jest.advanceTimersByTime(1200));
    expect(result.current.refreshing).toBe(false);
    act(() => result.current.onRefresh());
    expect(onHomePageRefresh).toHaveBeenCalledTimes(2);
  });
});
