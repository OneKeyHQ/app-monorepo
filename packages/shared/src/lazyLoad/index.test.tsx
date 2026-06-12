/** @jest-environment jsdom */

import { Component } from 'react';
import type { ReactNode } from 'react';

import LazyLoad, { MAX_LAZY_RETRIES, isRetryableLazyError } from '.';

import { render, screen, waitFor } from '@testing-library/react';

// Keep module imports clean under jest: the file logger pulls in native bits,
// and appVisibility reaches into platform signals. Both are stubbed here.
const mockWrite = jest.fn();
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Error: 'ERROR', Warning: 'WARNING' },
    NativeLogger: {
      write: (...args: unknown[]): void => {
        mockWrite(...args);
      },
    },
  }),
);

let mockVisible = true;
const mockVisibilitySubscribers = new Set<(visible: boolean) => void>();
jest.mock('../utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockVisible,
  onVisibilityStateChange: (cb: (visible: boolean) => void) => {
    mockVisibilitySubscribers.add(cb);
    return () => {
      mockVisibilitySubscribers.delete(cb);
    };
  },
}));
function setMockVisible(visible: boolean) {
  mockVisible = visible;
  mockVisibilitySubscribers.forEach((cb) => cb(visible));
}

// Single shared error boundary (eslint max-classes-per-file allows only one
// class per file): renders a sentinel + reports the caught error so a test can
// assert the boundary escalated a non-retryable / budget-exhausted failure.
class CatchBoundary extends Component<
  { onCatch: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onCatch();
  }

  override render() {
    if (this.state.failed) return <div data-testid="parent-fatal">x</div>;
    return this.props.children;
  }
}

describe('isRetryableLazyError', () => {
  it('is retryable when retryable === true', () => {
    expect(isRetryableLazyError({ retryable: true })).toBe(true);
  });

  it('is retryable for SPLIT_BUNDLE_TIMEOUT code', () => {
    expect(isRetryableLazyError({ code: 'SPLIT_BUNDLE_TIMEOUT' })).toBe(true);
  });

  it('is retryable for SPLIT_BUNDLE_NO_RUNTIME code', () => {
    expect(isRetryableLazyError({ code: 'SPLIT_BUNDLE_NO_RUNTIME' })).toBe(
      true,
    );
  });

  it('is retryable for a [SplitBundle] eval-timed-out message', () => {
    expect(
      isRetryableLazyError({
        message: '[SplitBundle] segment "home" eval timed out after 8000ms',
      }),
    ).toBe(true);
  });

  it('is retryable for a real Error carrying the timeout message', () => {
    const err = new Error('[SplitBundle] eval timed out');
    expect(isRetryableLazyError(err)).toBe(true);
  });

  it('is NOT retryable for SPLIT_BUNDLE_EVAL_ERROR code', () => {
    expect(isRetryableLazyError({ code: 'SPLIT_BUNDLE_EVAL_ERROR' })).toBe(
      false,
    );
  });

  it('is NOT retryable for SPLIT_BUNDLE_IO_ERROR code', () => {
    expect(isRetryableLazyError({ code: 'SPLIT_BUNDLE_IO_ERROR' })).toBe(false);
  });

  it('is NOT retryable for SPLIT_BUNDLE_NOT_FOUND / SHA256_MISMATCH codes', () => {
    expect(isRetryableLazyError({ code: 'SPLIT_BUNDLE_NOT_FOUND' })).toBe(
      false,
    );
    expect(isRetryableLazyError({ code: 'SPLIT_BUNDLE_SHA256_MISMATCH' })).toBe(
      false,
    );
  });

  it('is NOT retryable for a plain Error', () => {
    expect(isRetryableLazyError(new Error('boom'))).toBe(false);
  });

  it('is NOT retryable when the message only partially matches', () => {
    expect(isRetryableLazyError({ message: '[SplitBundle] not found' })).toBe(
      false,
    );
    expect(isRetryableLazyError({ message: 'eval timed out' })).toBe(false);
  });

  it('is NOT retryable for null / undefined / string primitives', () => {
    expect(isRetryableLazyError(null)).toBe(false);
    expect(isRetryableLazyError(undefined)).toBe(false);
    expect(isRetryableLazyError('SPLIT_BUNDLE_TIMEOUT')).toBe(false);
    expect(isRetryableLazyError(42)).toBe(false);
  });

  it('does NOT treat retryable === false as retryable', () => {
    expect(isRetryableLazyError({ retryable: false, code: 'X' })).toBe(false);
  });

  it('treats retryable === false as AUTHORITATIVE over a retryable code/message (permanently cached)', () => {
    // installProdBundleLoader clears `retryable` to false when it permanently
    // caches a budget-exhausted failure, even though the code/message still look
    // transient. That must surface as non-retryable so a dead route goes fatal
    // immediately instead of burning a retry round on every re-navigation.
    expect(
      isRetryableLazyError({
        retryable: false,
        code: 'SPLIT_BUNDLE_TIMEOUT',
      }),
    ).toBe(false);
    expect(
      isRetryableLazyError({
        retryable: false,
        message: '[SplitBundle] seg eval timed out after 30s',
      }),
    ).toBe(false);
  });
});

describe('LazyLoad self-heal', () => {
  beforeEach(() => {
    mockVisible = true;
    mockVisibilitySubscribers.clear();
    mockWrite.mockClear();
  });

  // Helper: a factory that rejects with `error` the first `failTimes` calls,
  // then resolves to a trivial component. Tracks the call count.
  function makeFactory(error: unknown, failTimes: number) {
    const calls = { count: 0 };
    const factory = () => {
      calls.count += 1;
      if (calls.count <= failTimes) {
        return Promise.reject(error);
      }
      return Promise.resolve({
        default: () => <div data-testid="loaded">loaded</div>,
      });
    };
    return { factory, calls };
  }

  it('retries a transient timeout, calls factory twice, eventually renders', async () => {
    const err = { code: 'SPLIT_BUNDLE_TIMEOUT', message: 'timed out' };
    const { factory, calls } = makeFactory(err, 1);
    const Lazy = LazyLoad<Record<string, never>>(
      factory as any,
      undefined,
      <div data-testid="fallback">loading</div>,
    );

    render(<Lazy />);

    // Real timers: the 150ms retry backoff fires, regenerates the lazy() object,
    // and the second factory call resolves. waitFor polls until it renders.
    await waitFor(
      () => {
        expect(screen.queryByTestId('loaded')).not.toBeNull();
      },
      { timeout: 4000 },
    );
    expect(calls.count).toBe(2);
    expect(mockWrite).toHaveBeenCalledWith(
      'WARNING',
      expect.stringContaining('[LazyLoad] retryable segment error (attempt 1/'),
    );
  });

  it('does NOT retry a non-retryable error: factory called once, error escalates', async () => {
    const err = { code: 'SPLIT_BUNDLE_EVAL_ERROR', message: 'bad eval' };
    const { factory, calls } = makeFactory(err, 1);
    const Lazy = LazyLoad<Record<string, never>>(
      factory as any,
      undefined,
      <div data-testid="fallback">loading</div>,
    );

    const onParentCatch = jest.fn();

    render(
      <CatchBoundary onCatch={onParentCatch}>
        <Lazy />
      </CatchBoundary>,
    );

    await waitFor(() => {
      expect(onParentCatch).toHaveBeenCalled();
    });
    expect(calls.count).toBe(1);
    expect(screen.queryByTestId('parent-fatal')).not.toBeNull();
  });

  it('escalates after MAX_LAZY_RETRIES retryable failures', async () => {
    const err = { code: 'SPLIT_BUNDLE_TIMEOUT', message: 'timed out' };
    // Always reject (failTimes huge) so the boundary exhausts its budget.
    const { factory, calls } = makeFactory(err, Number.MAX_SAFE_INTEGER);
    const Lazy = LazyLoad<Record<string, never>>(
      factory as any,
      undefined,
      <div data-testid="fallback">loading</div>,
    );

    const onParentCatch = jest.fn();

    render(
      <CatchBoundary onCatch={onParentCatch}>
        <Lazy />
      </CatchBoundary>,
    );

    await waitFor(
      () => {
        expect(onParentCatch).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );
    // initial attempt + MAX_LAZY_RETRIES retries, then fatal.
    expect(calls.count).toBe(MAX_LAZY_RETRIES + 1);
    expect(screen.queryByTestId('parent-fatal')).not.toBeNull();
  });

  it('defers the retry while backgrounded, then retries on foreground', async () => {
    mockVisible = false; // app starts backgrounded
    const err = { code: 'SPLIT_BUNDLE_TIMEOUT', message: 'timed out' };
    const { factory, calls } = makeFactory(err, 1);
    const Lazy = LazyLoad<Record<string, never>>(
      factory as any,
      undefined,
      <div data-testid="fallback">loading</div>,
    );

    render(<Lazy />);

    // First attempt fails; while backgrounded the boundary must NOT retry.
    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith(
        'WARNING',
        expect.stringContaining('[LazyLoad] retryable segment error'),
      );
    });
    expect(calls.count).toBe(1);
    expect(screen.queryByTestId('loaded')).toBeNull();

    // Foreground transition releases the deferred retry.
    setMockVisible(true);

    await waitFor(
      () => {
        expect(screen.queryByTestId('loaded')).not.toBeNull();
      },
      { timeout: 4000 },
    );
    expect(calls.count).toBe(2);
  });

  it('re-defers instead of retrying if the app re-backgrounds during the backoff window', async () => {
    mockVisible = false; // start backgrounded
    const err = { code: 'SPLIT_BUNDLE_TIMEOUT', message: 'timed out' };
    const { factory, calls } = makeFactory(err, 1);
    const Lazy = LazyLoad<Record<string, never>>(
      factory as any,
      undefined,
      <div data-testid="fallback">loading</div>,
    );

    render(<Lazy />);

    // First failure is caught and deferred (backgrounded).
    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith(
        'WARNING',
        expect.stringContaining('[LazyLoad] retryable segment error'),
      );
    });
    expect(calls.count).toBe(1);

    // Foreground briefly: the defer subscription arms the backoff timer...
    setMockVisible(true);
    // ...but the app re-backgrounds before that timer fires (no active
    // subscriber to notify at this instant — model it as a raw visibility flip).
    mockVisible = false;

    // After the backoff window, `fire` must observe it's hidden and RE-DEFER
    // rather than retry in the background — so the factory is NOT called again.
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });
    expect(calls.count).toBe(1);
    expect(screen.queryByTestId('loaded')).toBeNull();

    // A stable foreground finally lets the single retry through.
    setMockVisible(true);
    await waitFor(
      () => {
        expect(screen.queryByTestId('loaded')).not.toBeNull();
      },
      { timeout: 4000 },
    );
    expect(calls.count).toBe(2);
  });
});
