/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import {
  clearHideTabBarRequests,
  isTabBarHiddenByRequest,
} from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

import { useMarketDetailTabBarVisibility } from './useMarketDetailTabBarVisibility';

let mockFocused = true;
let mockRootDepth = 1;
const mockListeners = new Map<string, () => void>();
const mockNavigation = {
  isFocused: () => mockFocused,
  addListener: (event: string, callback: () => void) => {
    mockListeners.set(event, callback);
    return () => mockListeners.delete(event);
  },
};

jest.mock('@react-navigation/native', () => ({
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
  default: { isNative: true },
}));
jest.mock('../../utils/marketDetailNavigation', () => ({
  finishMarketDetailTabBarTransition: jest.fn(),
}));

beforeEach(() => {
  mockFocused = true;
  mockRootDepth = 1;
  mockListeners.clear();
  clearHideTabBarRequests();
});

it('keeps the bar hidden throughout a modal and restores it when leaving detail', () => {
  const { unmount } = renderHook(() => useMarketDetailTabBarVisibility(true));
  expect(isTabBarHiddenByRequest()).toBe(true);
  mockRootDepth = 2;
  mockFocused = false;
  mockListeners.get('state')?.();
  mockListeners.get('blur')?.();
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

it('releases the request when a modal navigates away and when unmounting under it', () => {
  const { unmount } = renderHook(() => useMarketDetailTabBarVisibility(true));
  mockFocused = false;
  mockRootDepth = 2;
  mockListeners.get('blur')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);
  mockRootDepth = 1;
  mockListeners.get('state')?.();
  expect(isTabBarHiddenByRequest()).toBe(false);
  mockFocused = true;
  mockListeners.get('focus')?.();
  mockFocused = false;
  mockRootDepth = 2;
  mockListeners.get('blur')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);
  unmount();
  expect(isTabBarHiddenByRequest()).toBe(false);
});
