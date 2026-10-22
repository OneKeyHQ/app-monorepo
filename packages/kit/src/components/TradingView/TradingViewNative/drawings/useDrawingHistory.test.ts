/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { DEFAULT_DRAWING_STYLE } from './model';
import { getDrawingProfileKey, useDrawingHistory } from './useDrawingHistory';

import type {
  IDrawingHistoryData,
  IDrawingHistoryLoader,
} from './drawingHistory';
import type { IDrawing } from './model';

const candle = { t: 120, o: 10, h: 12, l: 9, c: 11, v: 100 };
const drawing: IDrawing = {
  ...DEFAULT_DRAWING_STYLE,
  id: 'profile',
  tool: 'volumeProfile',
  locked: false,
  points: [
    { time: 120, price: 12 },
    { time: 240, price: 9 },
  ],
};
const options = {
  drawings: [drawing],
  storageKey: 'ASTER',
  enabled: true,
  redraw: jest.fn(),
  context: {
    points: [candle, { ...candle, t: 180 }, { ...candle, t: 240 }],
    interval: 60,
  },
};

it('includes the whole last chart candle, caches compact bins and drops deleted profiles', async () => {
  const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
    .fn()
    .mockResolvedValue({ points: [candle], interval: 60 });
  const hook = renderHook((props) => useDrawingHistory(props), {
    initialProps: { ...options, loadHistory },
  });
  await waitFor(() =>
    expect(
      hook.result.current.current.get('profile')?.profile?.bins,
    ).toHaveLength(24),
  );
  expect(loadHistory.mock.calls[0].slice(0, 2)).toEqual([120, 299]);
  const entry = hook.result.current.current.get('profile');
  expect(entry?.key).toBe(getDrawingProfileKey(drawing, options.context));
  expect(entry?.profile).not.toHaveProperty('points');
  hook.rerender({
    ...options,
    loadHistory,
    drawings: [{ ...drawing, color: '#F23645' }],
  });
  expect(loadHistory).toHaveBeenCalledTimes(1);
  hook.rerender({ ...options, loadHistory, drawings: [] });
  expect(hook.result.current.current.size).toBe(0);
});

it('cancels stale history when the symbol changes', async () => {
  let resolveFirst: (data: IDrawingHistoryData | null) => void = () =>
    undefined;
  const first = new Promise<IDrawingHistoryData | null>((resolve) => {
    resolveFirst = resolve;
  });
  const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValueOnce({ points: [{ ...candle, v: 500 }], interval: 60 });
  const hook = renderHook((props) => useDrawingHistory(props), {
    initialProps: { ...options, loadHistory },
  });
  expect(loadHistory).toHaveBeenCalledTimes(1);
  const oldSignal = loadHistory.mock.calls[0][2];
  hook.rerender({ ...options, storageKey: 'BNB', loadHistory });
  await waitFor(() =>
    expect(hook.result.current.current.get('profile')?.profile).toBeDefined(),
  );
  expect(oldSignal.aborted).toBe(true);
  await act(async () => {
    resolveFirst({ points: [candle], interval: 60 });
    await first;
  });
  expect(
    hook.result.current.current
      .get('profile')
      ?.profile?.bins.reduce((sum, bin) => sum + bin.up + bin.down, 0),
  ).toBeCloseTo(500);
});

it('keeps a fallback after failure without repeatedly requesting the same range', async () => {
  const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
    .fn()
    .mockRejectedValue(new Error('History unavailable'));
  const hook = renderHook((props) => useDrawingHistory(props), {
    initialProps: { ...options, loadHistory },
  });
  await waitFor(() =>
    expect(hook.result.current.current.has('profile')).toBe(true),
  );
  expect(hook.result.current.current.get('profile')?.profile).toBeUndefined();
  hook.rerender({ ...options, loadHistory });
  expect(loadHistory).toHaveBeenCalledTimes(1);
});
