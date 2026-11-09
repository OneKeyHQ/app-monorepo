/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useDownloadProgress } from './index.desktop';

import type { IUpdateDownloadedEvent, IUpdateProgressUpdate } from './type';

const mockProgress = new Set<(progress: IUpdateProgressUpdate) => void>();
const mockDownloaded = new Set<(event: IUpdateDownloadedEvent) => void>();
jest.mock('./electronUpdateListeners', () => ({
  electronUpdateListeners: {
    onProgressUpdate: (callback: (progress: IUpdateProgressUpdate) => void) => {
      mockProgress.add(callback);
      return () => mockProgress.delete(callback);
    },
    onDownloaded: (callback: (event: IUpdateDownloadedEvent) => void) => {
      mockDownloaded.add(callback);
      return () => mockDownloaded.delete(callback);
    },
  },
}));
jest.mock('../../logger/logger', () => ({
  defaultLogger: { update: { app: { log: jest.fn() } } },
}));

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

function emitProgress(
  percent: number,
  bundleVersion?: string,
  latestVersion = '6.0.0',
) {
  act(() => {
    mockProgress.forEach((callback) =>
      callback({
        percent,
        latestVersion,
        bundleVersion,
        total: 100,
        transferred: percent,
        delta: 1,
        bytesPerSecond: 1,
      } as IUpdateProgressUpdate),
    );
    jest.advanceTimersByTime(20);
  });
}

test('bundle listeners ignore other destinations and shell completion', () => {
  const first = renderHook(() =>
    useDownloadProgress({ latestVersion: '6.0.0', bundleVersion: '123' }),
  );
  const second = renderHook(() =>
    useDownloadProgress({ latestVersion: '6.0.0', bundleVersion: '124' }),
  );
  const shell = renderHook(() => useDownloadProgress());
  emitProgress(10, '123');
  emitProgress(90, '124');
  emitProgress(60, '123', '6.1.0');
  expect(first.result.current).toBe(10);
  expect(second.result.current).toBe(90);
  expect(shell.result.current).toBe(0);
  act(() => {
    mockDownloaded.forEach((callback) => callback({ latestVersion: '6.0.0' }));
  });
  expect(first.result.current).toBe(10);
  expect(second.result.current).toBe(90);
  expect(shell.result.current).toBe(100);
});

test('changing the selected destination resets progress and filters before throttling', () => {
  const hook = renderHook(
    ({ bundleVersion }) =>
      useDownloadProgress({ latestVersion: '6.0.0', bundleVersion }),
    { initialProps: { bundleVersion: '123' } },
  );
  emitProgress(10, '123');
  hook.rerender({ bundleVersion: '124' });
  expect(hook.result.current).toBe(0);
  act(() => {
    mockProgress.forEach((callback) =>
      callback({
        percent: 30,
        latestVersion: '6.0.0',
        bundleVersion: '124',
      } as IUpdateProgressUpdate),
    );
    mockProgress.forEach((callback) =>
      callback({
        percent: 80,
        latestVersion: '6.0.0',
        bundleVersion: '123',
      } as IUpdateProgressUpdate),
    );
    jest.advanceTimersByTime(20);
  });
  expect(hook.result.current).toBe(30);
});
