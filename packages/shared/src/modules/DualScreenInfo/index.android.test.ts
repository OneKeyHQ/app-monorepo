/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  setSplitViewLayoutDisabled,
  useDualScreenWidth,
  useIsSpanningInDualScreen,
} from './index.android';

let mockSpanning = false;
let mockWindow = { width: 412, height: 800 };
let mockScreen = { width: 412, height: 800 };
const mockDimensionListeners = new Set<() => void>();
const mockSpanningListeners = new Map<number, () => void>();
let mockListenerId = 0;

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  ReactNativeDeviceUtils: {
    isDualScreenDevice: () => true,
    isSpanning: () => mockSpanning,
    addSpanningChangedListener: (callback: () => void) => {
      mockListenerId += 1;
      mockSpanningListeners.set(mockListenerId, callback);
      return mockListenerId;
    },
    removeSpanningChangedListener: (id: number) => {
      mockSpanningListeners.delete(id);
    },
  },
}));
jest.mock('expo-device', () => ({ deviceType: 1, DeviceType: { TABLET: 2 } }));
jest.mock('react-native', () => ({
  Dimensions: {
    get: (name: string) => (name === 'window' ? mockWindow : mockScreen),
    addEventListener: (_event: string, callback: () => void) => {
      mockDimensionListeners.add(callback);
      return { remove: () => mockDimensionListeners.delete(callback) };
    },
  },
}));

function setDimensions(width: number, height: number) {
  act(() => {
    mockWindow = { width, height };
    mockScreen = { width, height };
    mockDimensionListeners.forEach((callback) => callback());
  });
}

function setSpanning(spanning: boolean) {
  act(() => {
    mockSpanning = spanning;
    mockSpanningListeners.forEach((callback) => callback());
  });
}

function useFoldableLayout() {
  return {
    spanning: useIsSpanningInDualScreen(),
    width: useDualScreenWidth(),
  };
}

beforeEach(() => {
  mockSpanning = false;
  mockWindow = { width: 412, height: 800 };
  mockScreen = { ...mockWindow };
  setSplitViewLayoutDisabled(false);
});

it('updates when native spanning arrives after the dimension event', () => {
  const { result } = renderHook(useFoldableLayout);
  setDimensions(840, 700);
  expect(result.current).toEqual({ spanning: false, width: 840 });
  setSpanning(true);
  expect(result.current).toEqual({ spanning: true, width: 420 });

  setDimensions(412, 800);
  setSpanning(false);
  expect(result.current).toEqual({ spanning: false, width: 412 });
});

it('updates when dimensions arrive after native spanning, across repeated folds', () => {
  const { result } = renderHook(useFoldableLayout);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    setSpanning(true);
    expect(result.current.spanning).toBe(false);
    setDimensions(840, 700);
    expect(result.current).toEqual({ spanning: true, width: 420 });
    setSpanning(false);
    expect(result.current.spanning).toBe(false);
    setDimensions(412, 800);
    expect(result.current).toEqual({ spanning: false, width: 412 });
  }
});

it('keeps the single-pane width override and removes subscriptions on unmount', () => {
  const { result, unmount } = renderHook(useFoldableLayout);
  setDimensions(840, 700);
  setSpanning(true);
  act(() => setSplitViewLayoutDisabled(true));
  expect(result.current).toEqual({ spanning: true, width: 840 });
  unmount();
  expect(mockDimensionListeners.size).toBe(0);
  expect(mockSpanningListeners.size).toBe(0);
});
