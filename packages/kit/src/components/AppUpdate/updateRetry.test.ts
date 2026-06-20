// OCDS v1.1 §5.11 — focused unit tests for the cross-restart download retry /
// give-up loop (`runDownloadWithRetry`). The persistence half (the durable
// per-target budget) is tested in kit-bg's ServiceAppUpdate.test.ts; this file
// pins the LOOP contract: it honours the injected budget hooks, accumulates the
// persisted counter across simulated relaunches (= separate runDownloadWithRetry
// calls sharing one store), goes terminal with a DownloadGaveUpError, and resets
// on success.
//
// The one heavy dependency (`@onekeyhq/components/.../useNetInfo`) and the
// backoff timer are mocked so this runs in milliseconds and never resolves the
// `@onekeyhq/components` package (keeps it independent of the RN component harness).

import { DownloadGaveUpError, runDownloadWithRetry } from './updateRetry';

import type { IDownloadRetryOptions } from './updateRetry';

jest.mock('@onekeyhq/components/src/hooks/useNetInfo', () => ({
  globalNetInfo: {
    currentState: () => ({ isInternetReachable: true }),
    addEventListener: () => () => {},
  },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: () => Promise.resolve() }, // instant backoff
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { appUpdate: { log: () => {} } } },
}));

// A transient (recoverable) failure: not an unrecoverable code, so the loop
// retries it up to DOWNLOAD_RETRY_MAX_ATTEMPTS.
const transientError = () => new Error('network blip');

// Persisted budget hooks backed by a shared in-memory store. The store survives
// across separate runDownloadWithRetry() calls — that IS the cross-restart
// semantics (a relaunch is a fresh call against the same durable store).
function budgetHooks(
  store: { count: number },
  maxAttempts: number,
  reason: 'maxAttempts' | 'deadline' = 'maxAttempts',
): IDownloadRetryOptions {
  const state = () => ({ givenUp: store.count >= maxAttempts, reason });
  return {
    getBudget: async () => state(),
    recordAttempt: async () => {
      store.count += 1;
      return state();
    },
    resetBudget: async () => {
      store.count = 0;
    },
  };
}

describe('runDownloadWithRetry — OCDS §5.11 cross-restart budget', () => {
  test('entry guard: an already-exhausted budget is terminal without running the operation', async () => {
    const store = { count: 8 }; // already at the cap on entry
    const op = jest.fn(async () => 'ok');
    await expect(
      runDownloadWithRetry(op, 'ctx', budgetHooks(store, 8)),
    ).rejects.toBeInstanceOf(DownloadGaveUpError);
    expect(op).not.toHaveBeenCalled();
  });

  test('accumulates the persisted counter across relaunches and goes terminal at the cap', async () => {
    const store = { count: 0 };
    const op = jest.fn(async () => {
      throw transientError();
    });

    // Relaunch #1: the in-memory loop spends 6 attempts (0..MAX), each recording
    // one persisted attempt. The cap (8) is not yet hit, so it ends by throwing
    // the RAW transport error — NOT a give-up.
    await expect(
      runDownloadWithRetry(op, 'ctx', budgetHooks(store, 8)),
    ).rejects.not.toBeInstanceOf(DownloadGaveUpError);
    expect(store.count).toBe(6);

    // Relaunch #2: the persisted counter resumes at 6; the 8th recorded attempt
    // trips the cap → a definitive DownloadGaveUpError('maxAttempts'). No
    // infinite loop across launches (scenario #9).
    let caught: unknown;
    try {
      await runDownloadWithRetry(op, 'ctx', budgetHooks(store, 8));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DownloadGaveUpError);
    expect((caught as DownloadGaveUpError).reason).toBe('maxAttempts');
    expect(store.count).toBe(8);
  });

  test('success clears the persisted budget so the next target starts fresh', async () => {
    const store = { count: 0 };
    let calls = 0;
    const op = jest.fn(async () => {
      calls += 1;
      if (calls === 1) throw transientError(); // fail once, then succeed
      return 'done';
    });
    const result = await runDownloadWithRetry(op, 'ctx', budgetHooks(store, 8));
    expect(result).toBe('done');
    expect(store.count).toBe(0); // resetBudget ran on success
  });

  test('the wall-clock deadline reason is surfaced on the give-up', async () => {
    const store = { count: 1 };
    const op = jest.fn(async () => 'ok');
    let caught: unknown;
    try {
      // maxAttempts=1 with count already 1 + reason 'deadline' → entry guard trips.
      await runDownloadWithRetry(op, 'ctx', budgetHooks(store, 1, 'deadline'));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DownloadGaveUpError);
    expect((caught as DownloadGaveUpError).reason).toBe('deadline');
    expect(op).not.toHaveBeenCalled();
  });

  test('a single-stream fallback failure becomes a terminal DownloadGaveUpError(fallbackFailed)', async () => {
    const op = jest.fn(async () => {
      throw transientError();
    });
    let caught: unknown;
    try {
      await runDownloadWithRetry(op, 'ctx', {
        isFallbackFailure: () => true, // the terminal error came from the fallback path
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DownloadGaveUpError);
    expect((caught as DownloadGaveUpError).reason).toBe('fallbackFailed');
  });

  test('without budget hooks it is the legacy loop: raw error after the in-memory attempts, no give-up wrapping', async () => {
    const op = jest.fn(async () => {
      throw transientError();
    });
    await expect(runDownloadWithRetry(op, 'ctx')).rejects.not.toBeInstanceOf(
      DownloadGaveUpError,
    );
    // 6 in-memory attempts (0..DOWNLOAD_RETRY_MAX_ATTEMPTS).
    expect(op).toHaveBeenCalledTimes(6);
  });
});
