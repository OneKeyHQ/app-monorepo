/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import {
  clearHideTabBarRequests,
  isTabBarHiddenByRequest,
  releaseHideTabBar,
  requestHideTabBar,
} from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

import { useDustSweepTabBarVisibility } from './useDustSweepTabBarVisibility';

let mockFocused = true;
let mockRootDepth = 1;
let mockIsNative = true;
const mockListeners = new Map<string, () => void>();
const mockNavigation = {
  isFocused: () => mockFocused,
  addListener: (event: string, callback: () => void) => {
    mockListeners.set(event, callback);
    return () => mockListeners.delete(event);
  },
};

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      addListener: (event: string, callback: () => void) =>
        mockNavigation.addListener(event, callback),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  getRootRoutersLength: () => mockRootDepth,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

beforeEach(() => {
  mockFocused = true;
  mockRootDepth = 1;
  mockIsNative = true;
  mockListeners.clear();
  clearHideTabBarRequests();
});

it('keeps the request while a native modal covers the page and releases it on exit', () => {
  const { unmount } = renderHook(() => useDustSweepTabBarVisibility(true));
  expect(isTabBarHiddenByRequest()).toBe(true);

  mockRootDepth = 2;
  mockFocused = false;
  mockListeners.get('blur')?.();
  mockListeners.get('state')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);

  // A cancelled gesture leaves the modal and its underlying page in place.
  mockListeners.get('state')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);

  mockRootDepth = 1;
  mockFocused = true;
  mockListeners.get('state')?.();
  mockListeners.get('focus')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);

  mockFocused = false;
  mockListeners.get('blur')?.();
  expect(isTabBarHiddenByRequest()).toBe(false);
  unmount();
});

it('releases the request when the modal closes over another page or on unmount', () => {
  const { unmount } = renderHook(() => useDustSweepTabBarVisibility(true));
  mockRootDepth = 2;
  mockFocused = false;
  mockListeners.get('blur')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);
  mockRootDepth = 1;
  mockListeners.get('state')?.();
  expect(isTabBarHiddenByRequest()).toBe(false);
  mockFocused = true;
  mockListeners.get('focus')?.();
  mockRootDepth = 2;
  mockFocused = false;
  mockListeners.get('blur')?.();
  unmount();
  expect(isTabBarHiddenByRequest()).toBe(false);
});

it('does not release another owner and preserves non-native blur behavior', () => {
  requestHideTabBar('other');
  const { unmount } = renderHook(() => useDustSweepTabBarVisibility(true));
  mockFocused = false;
  mockListeners.get('blur')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);
  releaseHideTabBar('other');
  expect(isTabBarHiddenByRequest()).toBe(false);
  unmount();

  mockIsNative = false;
  mockFocused = true;
  const nonNative = renderHook(() => useDustSweepTabBarVisibility(true));
  mockRootDepth = 2;
  mockFocused = false;
  mockListeners.get('blur')?.();
  expect(isTabBarHiddenByRequest()).toBe(false);
  nonNative.unmount();
});

it('does not hide the tab bar when disabled', () => {
  renderHook(() => useDustSweepTabBarVisibility(false));
  expect(isTabBarHiddenByRequest()).toBe(false);
});
