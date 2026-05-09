/**
 * @jest-environment jsdom
 */
// Tests for the JS-process-wide single-flight mutex used by
// downloadPackage() to collapse concurrent foreground triggers (cold-launch
// useEffect, AppState 'active' listener, manual button click) into one
// in-flight Promise. Without this collapse, the second caller hits the
// native "Already downloading" guard which the retry layer treats as
// unrecoverable, stranding the original healthy download.
//
// yarn jest packages/kit/src/components/AppUpdate/updateMutex.test.ts

import {
  __resetDownloadMutexForTests,
  getInFlightDownloadPackage,
  withDownloadMutex,
} from './updateMutex';

beforeEach(() => {
  __resetDownloadMutexForTests();
});

describe('withDownloadMutex', () => {
  test('returns the same Promise to concurrent callers (no second run)', async () => {
    const run = jest.fn(() => new Promise<void>(() => {}));
    const p1 = withDownloadMutex(run);
    const p2 = withDownloadMutex(run);
    const p3 = withDownloadMutex(run);
    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('clears the slot after the in-flight Promise resolves', async () => {
    let resolveRun!: () => void;
    const run = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolveRun = r;
        }),
    );
    const first = withDownloadMutex(run);
    expect(getInFlightDownloadPackage()).toBe(first);
    resolveRun();
    await first;
    expect(getInFlightDownloadPackage()).toBeNull();
  });

  test('clears the slot after the in-flight Promise rejects', async () => {
    let rejectRun!: (e: unknown) => void;
    const run = jest.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectRun = reject;
        }),
    );
    const first = withDownloadMutex(run);
    expect(getInFlightDownloadPackage()).toBe(first);
    rejectRun(new Error('boom'));
    await expect(first).rejects.toThrow('boom');
    expect(getInFlightDownloadPackage()).toBeNull();
  });

  test('after the first attempt settles, a new caller starts a fresh run', async () => {
    const run = jest.fn(() => Promise.resolve());
    await withDownloadMutex(run);
    expect(run).toHaveBeenCalledTimes(1);
    await withDownloadMutex(run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('a concurrent caller observes the rejection of the first (no second run)', async () => {
    let rejectRun!: (e: unknown) => void;
    const run = jest.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectRun = reject;
        }),
    );
    const first = withDownloadMutex(run);
    const second = withDownloadMutex(run);
    rejectRun(new Error('shared-failure'));
    await expect(first).rejects.toThrow('shared-failure');
    await expect(second).rejects.toThrow('shared-failure');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('getInFlightDownloadPackage', () => {
  test('returns null when no download is in flight', () => {
    expect(getInFlightDownloadPackage()).toBeNull();
  });

  test('returns the in-flight Promise while a run is active', () => {
    const run = () => new Promise<void>(() => {});
    const p = withDownloadMutex(run);
    expect(getInFlightDownloadPackage()).toBe(p);
  });
});

describe('__resetDownloadMutexForTests', () => {
  test('clears a stuck slot so the next case starts clean', () => {
    void withDownloadMutex(() => new Promise<void>(() => {}));
    expect(getInFlightDownloadPackage()).not.toBeNull();
    __resetDownloadMutexForTests();
    expect(getInFlightDownloadPackage()).toBeNull();
  });
});
