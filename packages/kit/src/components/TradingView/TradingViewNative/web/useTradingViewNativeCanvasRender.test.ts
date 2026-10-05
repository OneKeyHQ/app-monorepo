/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useTradingViewNativeCanvasRender } from './useTradingViewNativeCanvasRender';

describe('useTradingViewNativeCanvasRender', () => {
  let nextFrameId: number;
  const frames = new Map<number, FrameRequestCallback>();
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    nextFrameId = 0;
    frames.clear();
    globalThis.requestAnimationFrame = (cb) => {
      nextFrameId += 1;
      frames.set(nextFrameId, cb);
      return nextFrameId;
    };
    globalThis.cancelAnimationFrame = (id) => {
      if (typeof id === 'number') {
        frames.delete(id);
      }
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  function flushFrame() {
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach((callback) => callback(16)));
  }

  it('coalesces pointer and data updates and draws the latest committed data', () => {
    const initialDraw = jest.fn();
    const latestDraw = jest.fn();
    const { result, rerender } = renderHook(
      ({ draw }) => useTradingViewNativeCanvasRender(draw),
      { initialProps: { draw: initialDraw } },
    );
    const requestRender = result.current;
    act(() => {
      requestRender();
      requestRender();
    });
    rerender({ draw: latestDraw });
    expect(result.current).toBe(requestRender);
    expect(frames.size).toBe(1);
    expect(initialDraw).not.toHaveBeenCalled();

    flushFrame();
    expect(initialDraw).not.toHaveBeenCalled();
    expect(latestDraw).toHaveBeenCalledTimes(1);
    act(() => requestRender());
    flushFrame();
    expect(latestDraw).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending paint when its chart unmounts', () => {
    const draw = jest.fn();
    const { unmount } = renderHook(() =>
      useTradingViewNativeCanvasRender(draw),
    );
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    flushFrame();
    expect(draw).not.toHaveBeenCalled();
  });
});
