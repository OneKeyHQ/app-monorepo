/** @jest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { createDrawingHistoryLoader } from './drawingHistory';
import { DEFAULT_DRAWING_STYLE } from './model';
import { getDrawingProfileKey, useDrawingHistory } from './useDrawingHistory';

import type {
  IDrawingHistoryData,
  IDrawingHistoryLoader,
} from './drawingHistory';
import type { IDrawing } from './model';
import type { ITradingViewNativeHistoryDataProvider } from '../data/providers/types';

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

describe('history retries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('caches single-point-type history without scheduling retries', async () => {
    const fetchHistory: jest.MockedFunction<
      ITradingViewNativeHistoryDataProvider['fetchHistory']
    > = jest.fn().mockResolvedValue({
      pointType: 'single',
      points: [{ ...candle, t: 180, v: 0 }],
      total: 1,
    });
    const loadHistory = createDrawingHistoryLoader({
      fetchHistory,
      hasMoreHistory: () => false,
      getHistoryRequestCandleCount: () => 10,
    });
    const hook = renderHook(() =>
      useDrawingHistory({ ...options, loadHistory }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    const profile = hook.result.current.current.get('profile')?.profile;
    expect(profile?.interval).toBe(60);
    expect(profile?.bins).toHaveLength(24);
    expect(profile?.bins.reduce((sum, bin) => sum + bin.up + bin.down, 0)).toBe(
      0,
    );
    expect(fetchHistory).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('recovers from rejected, missing and unusable history without a range change', async () => {
    const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
      .fn()
      .mockRejectedValueOnce(new Error('History unavailable'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ points: [], interval: 60 })
      .mockResolvedValue({ points: [candle], interval: 60 });
    const hook = renderHook((props) => useDrawingHistory(props), {
      initialProps: { ...options, loadHistory },
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(hook.result.current.current.has('profile')).toBe(false);
    for (const delay of [1000, 3000]) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(delay);
      });
      expect(hook.result.current.current.has('profile')).toBe(false);
    }
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(loadHistory).toHaveBeenCalledTimes(4);
    expect(
      hook.result.current.current.get('profile')?.profile.bins,
    ).toHaveLength(24);

    hook.rerender({ ...options, loadHistory });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(loadHistory).toHaveBeenCalledTimes(4);
  });

  it('bounds retries while retaining the fallback for a persistent failure', async () => {
    const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
      .fn()
      .mockRejectedValue(new Error('History unavailable'));
    const hook = renderHook((props) => useDrawingHistory(props), {
      initialProps: { ...options, loadHistory },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(loadHistory).toHaveBeenCalledTimes(4);
    expect(hook.result.current.current.has('profile')).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retries only failed profiles while keeping successful ranges cached', async () => {
    const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
      .fn()
      .mockResolvedValueOnce({ points: [candle], interval: 60 })
      .mockRejectedValueOnce(new Error('History unavailable'))
      .mockResolvedValue({ points: [candle], interval: 60 });
    const hook = renderHook(() =>
      useDrawingHistory({
        ...options,
        drawings: [drawing, { ...drawing, id: 'second-profile' }],
        loadHistory,
      }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(loadHistory).toHaveBeenCalledTimes(3);
    expect(hook.result.current.current.size).toBe(2);
  });

  it('cancels a pending retry when the symbol changes', async () => {
    const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
      .fn()
      .mockRejectedValueOnce(new Error('History unavailable'))
      .mockResolvedValue({ points: [candle], interval: 60 });
    const hook = renderHook((props) => useDrawingHistory(props), {
      initialProps: { ...options, loadHistory },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    const oldSignal = loadHistory.mock.calls[0][2];
    hook.rerender({ ...options, loadHistory, storageKey: 'BNB' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(oldSignal.aborted).toBe(true);
    expect(loadHistory).toHaveBeenCalledTimes(2);
    expect(hook.result.current.current.get('profile')?.profile).toBeDefined();
  });

  it.each(['unmount', 'disable', 'remove'] as const)(
    'cancels pending retries on %s',
    async (action) => {
      const loadHistory: jest.MockedFunction<IDrawingHistoryLoader> = jest
        .fn()
        .mockRejectedValue(new Error('History unavailable'));
      const hook = renderHook((props) => useDrawingHistory(props), {
        initialProps: { ...options, loadHistory },
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      const oldSignal = loadHistory.mock.calls[0][2];
      if (action === 'unmount') hook.unmount();
      else if (action === 'disable')
        hook.rerender({ ...options, loadHistory, enabled: false });
      else hook.rerender({ ...options, loadHistory, drawings: [] });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });
      expect(oldSignal.aborted).toBe(true);
      expect(loadHistory).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    },
  );
});
