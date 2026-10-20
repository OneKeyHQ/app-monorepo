/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useTradingViewNativePresentationReady } from './useTradingViewNativePresentationReady';

import type { CanvasRef, SkImage } from '@shopify/react-native-skia';

function createCanvas() {
  const getNativeId = jest.fn(() => 1);
  const redraw = jest.fn();
  const makeImageSnapshotAsync = jest.fn<Promise<SkImage>, []>();
  const canvas = {
    getNativeId,
    redraw,
    makeImageSnapshotAsync,
  } as unknown as CanvasRef;
  return { canvas, getNativeId, redraw, makeImageSnapshotAsync };
}

describe('native chart presentation readiness', () => {
  it('waits for a rendered image and tolerates a new handle for the same native canvas', async () => {
    const { canvas, redraw, makeImageSnapshotAsync } = createCanvas();
    let complete: (image: SkImage) => void = () => undefined;
    makeImageSnapshotAsync.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const ref = { current: canvas };
    const onReady = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewNativePresentationReady(ref, onReady),
    );
    act(() => result.current({ width: 780, height: 320 }));
    expect(onReady).not.toHaveBeenCalled();
    ref.current = { ...canvas } as CanvasRef;
    const dispose = jest.fn();
    await act(async () => complete({ dispose } as unknown as SkImage));
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(redraw).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith({ width: 780, height: 320 });
  });

  it.each(['resize', 'unmount', 'replace'])(
    'discards stale drawing completion after %s',
    async (action) => {
      const { canvas, makeImageSnapshotAsync } = createCanvas();
      let complete: (image: SkImage) => void = () => undefined;
      makeImageSnapshotAsync.mockReturnValueOnce(
        new Promise((resolve) => {
          complete = resolve;
        }),
      );
      makeImageSnapshotAsync.mockReturnValue(new Promise(() => undefined));
      const ref = { current: canvas };
      const onReady = jest.fn();
      const { result, unmount } = renderHook(() =>
        useTradingViewNativePresentationReady(ref, onReady),
      );
      act(() => result.current({ width: 390, height: 320 }));
      if (action === 'resize')
        act(() => result.current({ width: 780, height: 320 }));
      if (action === 'unmount') unmount();
      if (action === 'replace')
        ref.current = { ...canvas, getNativeId: () => 2 } as CanvasRef;
      const dispose = jest.fn();
      await act(async () => complete({ dispose } as unknown as SkImage));
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(onReady).not.toHaveBeenCalled();
    },
  );
});
