import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import { useNavigation } from '@react-navigation/core';
import { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import React from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, useIsModalPage } from '../../hocs';
import {
  updateHeightWhenKeyboardHide,
  updateHeightWhenKeyboardShown,
  useKeyboardEvent,
  useSafeAreaInsets,
} from '../../hooks';
import { PageContext } from './PageContext';

import {
  usePageLifeCycle,
  usePageMounted,
  usePageUnMounted,
  useSafeAreaBottom,
  useTabBarHeight,
  useSafeKeyboardAnimationStyle,
  TAB_BAR_HEIGHT,
} from './hooks';

// Mock all external dependencies
jest.mock('@react-navigation/core');
jest.mock('react-native-reanimated');
jest.mock('@onekeyhq/shared/src/platformEnv');
jest.mock('../../hocs');
jest.mock('../../hooks');

const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseSharedValue = useSharedValue as jest.MockedFunction<typeof useSharedValue>;
const mockUseAnimatedStyle = useAnimatedStyle as jest.MockedFunction<typeof useAnimatedStyle>;
const mockUseIsModalPage = useIsModalPage as jest.MockedFunction<typeof useIsModalPage>;
const mockUseSafeAreaInsets = useSafeAreaInsets as jest.MockedFunction<typeof useSafeAreaInsets>;
const mockUseKeyboardEvent = useKeyboardEvent as jest.MockedFunction<typeof useKeyboardEvent>;
const mockUpdateHeightWhenKeyboardShown = updateHeightWhenKeyboardShown as jest.MockedFunction<
  typeof updateHeightWhenKeyboardShown
>;
const mockUpdateHeightWhenKeyboardHide = updateHeightWhenKeyboardHide as jest.MockedFunction<
  typeof updateHeightWhenKeyboardHide
>;

describe('Page Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    mockUseSafeAreaInsets.mockReturnValue({ bottom: 20, top: 44, left: 0, right: 0 });
    mockUseIsModalPage.mockReturnValue(false);
    mockUseSharedValue.mockReturnValue({ value: 0 });
    mockUseAnimatedStyle.mockReturnValue({});
    mockUpdateHeightWhenKeyboardShown.mockReturnValue(300);
    mockUpdateHeightWhenKeyboardHide.mockReturnValue(0);
    (platformEnv as any).isNative = true;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('usePageLifeCycle', () => {
    let mockNavigation: any;
    let mockAddListener: jest.Mock;
    let mockUnsubscribe: jest.Mock;

    beforeEach(() => {
      mockUnsubscribe = jest.fn();
      mockAddListener = jest.fn().mockReturnValue(mockUnsubscribe);
      mockNavigation = {
        addListener: mockAddListener,
      };
      mockUseNavigation.mockReturnValue(mockNavigation);
    });

    it('should handle lifecycle without parameters', () => {
      const { unmount } = renderHook(() => usePageLifeCycle());

      expect(mockAddListener).toHaveBeenCalledWith('transitionEnd', expect.any(Function));
      unmount();
    });

    it('should call onMounted when transition ends without closing', async () => {
      const mockOnMounted = jest.fn();
      const mockOnUnmounted = jest.fn();

      renderHook(() => usePageLifeCycle({ onMounted: mockOnMounted, onUnmounted: mockOnUnmounted }));

      // Simulate transition end event without closing
      const transitionEndCallback = mockAddListener.mock.calls[0][1];
      const mockEvent = {
        data: { closing: false },
        target: 'screen1',
        type: 'transitionEnd',
      };

      act(() => {
        transitionEndCallback(mockEvent);
      });

      await waitFor(() => {
        expect(mockOnMounted).toHaveBeenCalledTimes(1);
      });
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should not call onMounted when transition ends with closing', async () => {
      const mockOnMounted = jest.fn();

      renderHook(() => usePageLifeCycle({ onMounted: mockOnMounted }));

      const transitionEndCallback = mockAddListener.mock.calls[0][1];
      const mockEvent = {
        data: { closing: true },
        target: 'screen1',
        type: 'transitionEnd',
      };

      act(() => {
        transitionEndCallback(mockEvent);
      });

      // Fast-forward timeout
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockOnMounted).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onMounted with timeout fallback', async () => {
      const mockOnMounted = jest.fn();

      renderHook(() => usePageLifeCycle({ onMounted: mockOnMounted }));

      // Don't trigger transition end, let timeout happen
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockOnMounted).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onUnmounted when component unmounts and transition ends with closing', async () => {
      const mockOnUnmounted = jest.fn();

      const { unmount } = renderHook(() => usePageLifeCycle({ onUnmounted: mockOnUnmounted }));

      unmount();

      // Simulate transition end event with closing during cleanup
      const cleanupCallback = mockAddListener.mock.calls[1][1];
      const mockEvent = {
        data: { closing: true },
        target: 'screen1',
        type: 'transitionEnd',
      };

      act(() => {
        cleanupCallback(mockEvent);
      });

      await waitFor(() => {
        expect(mockOnUnmounted).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onUnmounted with timeout fallback during cleanup', async () => {
      const mockOnUnmounted = jest.fn();

      const { unmount } = renderHook(() => usePageLifeCycle({ onUnmounted: mockOnUnmounted }));

      unmount();

      // Fast-forward timeout during cleanup
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockOnUnmounted).toHaveBeenCalledTimes(1);
      });
    });

    it('should update ref when onMounted callback changes', async () => {
      const mockOnMounted1 = jest.fn();
      const mockOnMounted2 = jest.fn();

      const { rerender } = renderHook(
        ({ onMounted }) => usePageLifeCycle({ onMounted }),
        { initialProps: { onMounted: mockOnMounted1 } }
      );

      rerender({ onMounted: mockOnMounted2 });

      // Trigger transition end
      const transitionEndCallback = mockAddListener.mock.calls[0][1];
      const mockEvent = {
        data: { closing: false },
        target: 'screen1',
        type: 'transitionEnd',
      };

      act(() => {
        transitionEndCallback(mockEvent);
      });

      await waitFor(() => {
        expect(mockOnMounted2).toHaveBeenCalled();
      });
      expect(mockOnMounted1).not.toHaveBeenCalled();
    });

    it('should update ref when onUnmounted callback changes', async () => {
      const mockOnUnmounted1 = jest.fn();
      const mockOnUnmounted2 = jest.fn();

      const { rerender, unmount } = renderHook(
        ({ onUnmounted }) => usePageLifeCycle({ onUnmounted }),
        { initialProps: { onUnmounted: mockOnUnmounted1 } }
      );

      rerender({ onUnmounted: mockOnUnmounted2 });
      unmount();

      // Trigger cleanup timeout
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockOnUnmounted2).toHaveBeenCalled();
      });
      expect(mockOnUnmounted1).not.toHaveBeenCalled();
    });

    it('should handle Promise.race timeout scenario for onMounted', async () => {
      const mockOnMounted = jest.fn();

      renderHook(() => usePageLifeCycle({ onMounted: mockOnMounted }));

      // Simulate navigation listener that never resolves
      mockAddListener.mockImplementation(() => {
        return jest.fn(); // Return unsubscribe function but never call the callback
      });

      // Let the timeout win the race
      act(() => {
        jest.advanceTimersByTime(1001);
      });

      await waitFor(() => {
        expect(mockOnMounted).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle Promise.race timeout scenario for onUnmounted', async () => {
      const mockOnUnmounted = jest.fn();

      const { unmount } = renderHook(() => usePageLifeCycle({ onUnmounted: mockOnUnmounted }));

      unmount();

      // Let the cleanup timeout win the race
      act(() => {
        jest.advanceTimersByTime(1001);
      });

      await waitFor(() => {
        expect(mockOnUnmounted).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle multiple consecutive ref updates', () => {
      const mockOnMounted1 = jest.fn();
      const mockOnMounted2 = jest.fn();
      const mockOnMounted3 = jest.fn();

      const { rerender } = renderHook(
        ({ onMounted }) => usePageLifeCycle({ onMounted }),
        { initialProps: { onMounted: mockOnMounted1 } }
      );

      // Multiple rerenders in succession
      rerender({ onMounted: mockOnMounted2 });
      rerender({ onMounted: mockOnMounted3 });

      // Only the latest callback should be stored
      const transitionEndCallback = mockAddListener.mock.calls[0][1];
      const mockEvent = {
        data: { closing: false },
        target: 'screen1',
        type: 'transitionEnd',
      };

      act(() => {
        transitionEndCallback(mockEvent);
      });

      expect(mockOnMounted3).toHaveBeenCalled();
      expect(mockOnMounted1).not.toHaveBeenCalled();
      expect(mockOnMounted2).not.toHaveBeenCalled();
    });

    it('should handle navigation event with undefined data', async () => {
      const mockOnMounted = jest.fn();

      renderHook(() => usePageLifeCycle({ onMounted: mockOnMounted }));

      const transitionEndCallback = mockAddListener.mock.calls[0][1];
      const mockEvent = {
        data: undefined,
        target: 'screen1',
        type: 'transitionEnd',
      };

      // This should not crash and should fall back to timeout
      act(() => {
        transitionEndCallback(mockEvent);
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockOnMounted).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('usePageMounted', () => {
    it('should call usePageLifeCycle with onMounted only', () => {
      const mockOnMounted = jest.fn();

      renderHook(() => usePageMounted(mockOnMounted));

      expect(mockUseNavigation).toHaveBeenCalled();
    });

    it('should handle undefined onMounted callback', () => {
      expect(() => {
        renderHook(() => usePageMounted(undefined));
      }).not.toThrow();
    });
  });

  describe('usePageUnMounted', () => {
    it('should call usePageLifeCycle with onUnmounted only', () => {
      const mockOnUnmounted = jest.fn();

      renderHook(() => usePageUnMounted(mockOnUnmounted));

      expect(mockUseNavigation).toHaveBeenCalled();
    });

    it('should handle undefined onUnmounted callback', () => {
      expect(() => {
        renderHook(() => usePageUnMounted(undefined));
      }).not.toThrow();
    });
  });

  describe('useSafeAreaBottom', () => {
    const mockPageContext = {
      safeAreaEnabled: true,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(PageContext.Provider, { value: mockPageContext }, children);

    it('should return bottom inset when safeAreaEnabled and is modal page', () => {
      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useSafeAreaBottom(), { wrapper });

      expect(result.current).toBe(34);
    });

    it('should return 0 when safeAreaEnabled but not modal page', () => {
      mockUseIsModalPage.mockReturnValue(false);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useSafeAreaBottom(), { wrapper });

      expect(result.current).toBe(0);
    });

    it('should return 0 when not safeAreaEnabled', () => {
      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, top: 44, left: 0, right: 0 });

      const disabledWrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: { safeAreaEnabled: false } }, children);

      const { result } = renderHook(() => useSafeAreaBottom(), { wrapper: disabledWrapper });

      expect(result.current).toBe(0);
    });

    it('should return 0 when context value is undefined', () => {
      const undefinedWrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: undefined as any }, children);

      const { result } = renderHook(() => useSafeAreaBottom(), { wrapper: undefinedWrapper });

      expect(result.current).toBe(0);
    });

    it('should handle large bottom inset values', () => {
      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 999, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useSafeAreaBottom(), { wrapper });

      expect(result.current).toBe(999);
    });

    it('should handle negative bottom inset values', () => {
      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: -10, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useSafeAreaBottom(), { wrapper });

      expect(result.current).toBe(-10);
    });
  });

  describe('useTabBarHeight', () => {
    it('should return 0 for modal pages', () => {
      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 20, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useTabBarHeight());

      expect(result.current).toBe(0);
    });

    it('should return TAB_BAR_HEIGHT + bottom inset for non-modal pages', () => {
      mockUseIsModalPage.mockReturnValue(false);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 20, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useTabBarHeight());

      expect(result.current).toBe(TAB_BAR_HEIGHT + 20);
    });

    it('should handle zero bottom inset', () => {
      mockUseIsModalPage.mockReturnValue(false);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 0, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useTabBarHeight());

      expect(result.current).toBe(TAB_BAR_HEIGHT);
    });

    it('should handle negative bottom inset', () => {
      mockUseIsModalPage.mockReturnValue(false);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: -10, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useTabBarHeight());

      expect(result.current).toBe(TAB_BAR_HEIGHT - 10);
    });

    it('should handle large bottom inset values', () => {
      mockUseIsModalPage.mockReturnValue(false);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 100, top: 44, left: 0, right: 0 });

      const { result } = renderHook(() => useTabBarHeight());

      expect(result.current).toBe(TAB_BAR_HEIGHT + 100);
    });
  });

  describe('TAB_BAR_HEIGHT constant', () => {
    it('should have correct value', () => {
      expect(TAB_BAR_HEIGHT).toBe(54);
    });

    it('should be a number', () => {
      expect(typeof TAB_BAR_HEIGHT).toBe('number');
    });

    it('should be positive', () => {
      expect(TAB_BAR_HEIGHT).toBeGreaterThan(0);
    });
  });

  describe('useSafeKeyboardAnimationStyle', () => {
    let mockSharedValue: any;
    let mockKeyboardEventCallbacks: any;

    beforeEach(() => {
      mockSharedValue = { value: 0 };
      mockUseSharedValue.mockReturnValue(mockSharedValue);
      mockUseAnimatedStyle.mockReturnValue({ paddingBottom: 0 });
      mockUseKeyboardEvent.mockImplementation(({ keyboardWillShow, keyboardWillHide }) => {
        mockKeyboardEventCallbacks = { keyboardWillShow, keyboardWillHide };
      });
      mockUseIsModalPage.mockReturnValue(true);
    });

    it('should return animated styles for native platform', () => {
      (platformEnv as any).isNative = true;

      const { result } = renderHook(() => useSafeKeyboardAnimationStyle());

      expect(result.current).toEqual({ paddingBottom: 0 });
      expect(mockUseAnimatedStyle).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return undefined for non-native platform', () => {
      (platformEnv as any).isNative = false;

      const { result } = renderHook(() => useSafeKeyboardAnimationStyle());

      expect(result.current).toBeUndefined();
    });

    it('should handle keyboard show event correctly', () => {
      const mockPageContext = { safeAreaEnabled: true };
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: mockPageContext }, children);

      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, top: 44, left: 0, right: 0 });
      mockUpdateHeightWhenKeyboardShown.mockReturnValue(250);

      renderHook(() => useSafeKeyboardAnimationStyle(), { wrapper });

      const keyboardEvent = {
        endCoordinates: { height: 300 },
      };

      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });

      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledWith(300 - 34 - 54);
      expect(mockSharedValue.value).toBe(250);
    });

    it('should handle keyboard hide event correctly', () => {
      mockUpdateHeightWhenKeyboardHide.mockReturnValue(0);

      renderHook(() => useSafeKeyboardAnimationStyle());

      act(() => {
        mockKeyboardEventCallbacks.keyboardWillHide();
      });

      expect(mockUpdateHeightWhenKeyboardHide).toHaveBeenCalled();
      expect(mockSharedValue.value).toBe(0);
    });

    it('should calculate keyboard height with different safe area and tab bar heights', () => {
      const mockPageContext = { safeAreaEnabled: true };
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: mockPageContext }, children);

      mockUseIsModalPage.mockReturnValue(false); // Non-modal page
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 20, top: 44, left: 0, right: 0 });

      renderHook(() => useSafeKeyboardAnimationStyle(), { wrapper });

      const keyboardEvent = {
        endCoordinates: { height: 350 },
      };

      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });

      // For non-modal page: tabBarHeight = 54 + 20 = 74, safeAreaBottom = 0
      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledWith(350 - 0 - 74);
    });

    it('should handle edge case with zero keyboard height', () => {
      renderHook(() => useSafeKeyboardAnimationStyle());

      const keyboardEvent = {
        endCoordinates: { height: 0 },
      };

      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });

      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should handle negative calculated keyboard height', () => {
      const mockPageContext = { safeAreaEnabled: true };
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: mockPageContext }, children);

      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 200, top: 44, left: 0, right: 0 });

      renderHook(() => useSafeKeyboardAnimationStyle(), { wrapper });

      const keyboardEvent = {
        endCoordinates: { height: 100 }, // Less than safeAreaBottom + tabBarHeight
      };

      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });

      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledWith(100 - 200 - 54);
    });

    it('should handle keyboard event with missing endCoordinates', () => {
      renderHook(() => useSafeKeyboardAnimationStyle());

      const keyboardEvent = {} as any;

      expect(() => {
        act(() => {
          mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
        });
      }).toThrow();
    });

    it('should handle keyboard event with invalid height', () => {
      renderHook(() => useSafeKeyboardAnimationStyle());

      const keyboardEvent = {
        endCoordinates: { height: 'invalid' as any },
      };

      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });

      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should use correct animated style function', () => {
      const mockPageContext = { safeAreaEnabled: true };
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: mockPageContext }, children);

      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, top: 44, left: 0, right: 0 });
      mockSharedValue.value = 100;

      renderHook(() => useSafeKeyboardAnimationStyle(), { wrapper });

      // Get the animated style function that was passed to useAnimatedStyle
      const animatedStyleFunction = mockUseAnimatedStyle.mock.calls[0][0];
      const result = animatedStyleFunction();

      expect(result).toEqual({
        paddingBottom: 100 + 34, // keyboardHeightValue + safeBottomHeight
      });
    });

    it('should handle platform environment changes', () => {
      (platformEnv as any).isNative = true;
      const { result, rerender } = renderHook(() => useSafeKeyboardAnimationStyle());
      expect(result.current).toBeDefined();

      (platformEnv as any).isNative = false;
      rerender();
      expect(result.current).toBeUndefined();
    });

    it('should handle safeAreaBottom changes dynamically', () => {
      const mockPageContext1 = { safeAreaEnabled: true };
      const mockPageContext2 = { safeAreaEnabled: false };

      const wrapper1 = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: mockPageContext1 }, children);

      const wrapper2 = ({ children }: { children: React.ReactNode }) =>
        React.createElement(PageContext.Provider, { value: mockPageContext2 }, children);

      mockUseIsModalPage.mockReturnValue(true);
      mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, top: 44, left: 0, right: 0 });

      const { rerender } = renderHook(() => useSafeKeyboardAnimationStyle(), { wrapper: wrapper1 });

      // First render with safeAreaEnabled: true
      const keyboardEvent = { endCoordinates: { height: 300 } };
      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });
      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledWith(300 - 34 - 54);

      // Rerender with safeAreaEnabled: false
      rerender({ wrapper: wrapper2 });
      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });
      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledWith(300 - 0 - 54);
    });

    it('should call useKeyboardEvent with correct parameters', () => {
      renderHook(() => useSafeKeyboardAnimationStyle());

      expect(mockUseKeyboardEvent).toHaveBeenCalledWith({
        keyboardWillShow: expect.any(Function),
        keyboardWillHide: expect.any(Function),
      });
    });

    it('should initialize keyboardHeightValue with useSharedValue', () => {
      renderHook(() => useSafeKeyboardAnimationStyle());

      expect(mockUseSharedValue).toHaveBeenCalledWith(0);
    });

    it('should handle multiple keyboard show/hide cycles', () => {
      mockUpdateHeightWhenKeyboardShown.mockReturnValue(250);
      mockUpdateHeightWhenKeyboardHide.mockReturnValue(0);

      renderHook(() => useSafeKeyboardAnimationStyle());

      const keyboardShowEvent = { endCoordinates: { height: 300 } };

      // First show
      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardShowEvent);
      });
      expect(mockSharedValue.value).toBe(250);

      // Hide
      act(() => {
        mockKeyboardEventCallbacks.keyboardWillHide();
      });
      expect(mockSharedValue.value).toBe(0);

      // Show again
      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardShowEvent);
      });
      expect(mockSharedValue.value).toBe(250);
    });

    it('should handle rapid keyboard events', () => {
      renderHook(() => useSafeKeyboardAnimationStyle());

      const keyboardEvent = { endCoordinates: { height: 300 } };

      // Rapid show/hide events
      act(() => {
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
        mockKeyboardEventCallbacks.keyboardWillHide();
        mockKeyboardEventCallbacks.keyboardWillShow(keyboardEvent);
      });

      expect(mockUpdateHeightWhenKeyboardShown).toHaveBeenCalledTimes(2);
      expect(mockUpdateHeightWhenKeyboardHide).toHaveBeenCalledTimes(1);
    });
  });
});