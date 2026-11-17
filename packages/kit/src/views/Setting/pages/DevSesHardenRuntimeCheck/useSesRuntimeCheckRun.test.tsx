/** @jest-environment jsdom */
import { StrictMode } from 'react';

import { act, renderHook } from '@testing-library/react';

import type { ISesRuntimeCheckReport } from '@onekeyhq/shared/src/security/sesHarden/runtimeCheck';

import { useSesRuntimeCheckRun } from './useSesRuntimeCheckRun';

const report: ISesRuntimeCheckReport = {
  createdAt: '2026-11-16T00:00:00.000Z',
  level: 'L1',
  runtime: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    byDimension: {
      'runtime-state': { total: 0, passed: 0, failed: 0 },
      functionality: { total: 0, passed: 0, failed: 0 },
      'tamper-resistance': { total: 0, passed: 0, failed: 0 },
    },
  },
  patchWarnings: {
    enabled: false,
    installed: false,
    limit: 0,
    uniqueCount: 0,
    totalRecorded: 0,
    items: [],
  },
  coverage: [],
  checks: [],
};

beforeEach(() =>
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] }),
);
afterEach(() => jest.useRealTimers());

test('a failed rerun removes a previous successful report', async () => {
  const collect = jest.fn(async () => report);
  const { result } = renderHook(() => useSesRuntimeCheckRun(collect));
  await act(async () => {});
  expect(result.current.report).toBe(report);
  collect.mockRejectedValueOnce(new Error('collector failed'));
  await act(async () => {
    await result.current.runChecks();
  });
  expect(result.current.report).toBeUndefined();
  expect(result.current.error).toBe('collector failed');
  expect(result.current.isRunning).toBe(false);
});

test('a hanging rerun clears the old report immediately and rejects late results', async () => {
  const collect = jest.fn(async () => report);
  const { result } = renderHook(() => useSesRuntimeCheckRun(collect, 100));
  await act(async () => {});
  expect(result.current.report).toBe(report);
  let finish: (value: ISesRuntimeCheckReport) => void = () => {};
  collect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => {
    void result.current.runChecks();
  });
  expect(result.current.report).toBeUndefined();
  expect(result.current.isRunning).toBe(true);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
  });
  expect(result.current.error).toBe('SES diagnostic run exceeded 100ms');
  expect(result.current.isRunning).toBe(false);
  await act(async () => {
    finish(report);
  });
  expect(result.current.report).toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
});

test('superseded runs and unmounts cancel their resources', async () => {
  const signals: AbortSignal[] = [];
  const collect = (signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<ISesRuntimeCheckReport>(() => {});
  };
  const { result, unmount } = renderHook(() => useSesRuntimeCheckRun(collect));
  await act(async () => {});
  act(() => {
    void result.current.runChecks();
  });
  await act(async () => {});
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  unmount();
  expect(signals[1].aborted).toBe(true);
  await act(async () => {});
  expect(jest.getTimerCount()).toBe(0);
});

test('StrictMode effect replay leaves a live successful run', async () => {
  const collect = jest.fn(async () => report);
  const { result } = renderHook(() => useSesRuntimeCheckRun(collect), {
    wrapper: StrictMode,
  });
  await act(async () => {});
  expect(result.current.report).toBe(report);
  expect(result.current.error).toBeUndefined();
  expect(result.current.isRunning).toBe(false);
});
