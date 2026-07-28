/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native';

import type { ITabContainerRef } from '@onekeyhq/components';

import { useSyncedMarketTab } from './useSyncedMarketTab';

describe('useSyncedMarketTab', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let nextFrameId = 1;
  let frameCallbacks = new Map<number, FrameRequestCallback>();

  const flushNextFrame = () => {
    const nextFrame = frameCallbacks.entries().next().value;
    expect(nextFrame).toBeDefined();
    if (!nextFrame) {
      return;
    }
    const [frameId, callback] = nextFrame;
    frameCallbacks.delete(frameId);
    act(() => callback(0));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    nextFrameId = 1;
    frameCallbacks = new Map();
    globalThis.requestAnimationFrame = jest.fn((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(frameId, callback);
      return frameId;
    });
    globalThis.cancelAnimationFrame = jest.fn((frameId) => {
      frameCallbacks.delete(frameId);
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('uses one corrective jump after a deferred stale-page sync request', () => {
    let focusedTab = 'Stocks';
    let shouldDefer = false;
    const jumpToTab = jest.fn();
    const syncCurrentPage = jest.fn();
    const onBeforeJumpToTab = jest.fn(() => {
      shouldDefer = true;
    });
    const tabContainerRef: ITabContainerRef = {
      getCurrentIndex: jest.fn(() => 2),
      getFocusedTab: jest.fn(() => focusedTab),
      jumpToTab,
      setIndex: jest.fn(),
      syncCurrentPage,
    };
    const tabsRef = { current: tabContainerRef };

    const { result, unmount } = renderHook(() =>
      useSyncedMarketTab('Stocks', tabsRef, true, {
        onBeforeJumpToTab,
        shouldDeferPageSync: () => shouldDefer,
      }),
    );

    focusedTab = 'Favorites';
    shouldDefer = true;
    act(() => result.current.requestPageSync());
    flushNextFrame();
    expect(jumpToTab).not.toHaveBeenCalled();
    expect(syncCurrentPage).not.toHaveBeenCalled();

    shouldDefer = false;
    act(() => jest.advanceTimersByTime(32));
    flushNextFrame();
    expect(jumpToTab).toHaveBeenCalledTimes(1);
    expect(jumpToTab).toHaveBeenCalledWith('Stocks');
    expect(onBeforeJumpToTab).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(32));
    flushNextFrame();
    expect(jumpToTab).toHaveBeenCalledTimes(1);
    expect(syncCurrentPage).not.toHaveBeenCalled();

    focusedTab = 'Stocks';
    shouldDefer = false;
    act(() => jest.advanceTimersByTime(32));
    flushNextFrame();
    expect(jumpToTab).toHaveBeenCalledTimes(1);
    expect(syncCurrentPage).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('does not revive a cancelled sync request after user drag starts', () => {
    let focusedTab = 'Stocks';
    const jumpToTab = jest.fn();
    const syncCurrentPage = jest.fn();
    const tabContainerRef: ITabContainerRef = {
      getCurrentIndex: jest.fn(() => 2),
      getFocusedTab: jest.fn(() => focusedTab),
      jumpToTab,
      setIndex: jest.fn(),
      syncCurrentPage,
    };
    const tabsRef = { current: tabContainerRef };

    const { result, unmount } = renderHook(() =>
      useSyncedMarketTab('Stocks', tabsRef, true),
    );

    focusedTab = 'Favorites';
    act(() => result.current.requestPageSync());
    expect(frameCallbacks.size).toBe(1);

    act(() => result.current.cancelPageSync());
    act(() => jest.advanceTimersByTime(1000));
    expect(frameCallbacks.size).toBe(0);
    expect(jumpToTab).not.toHaveBeenCalled();
    expect(syncCurrentPage).not.toHaveBeenCalled();

    unmount();
  });
});
