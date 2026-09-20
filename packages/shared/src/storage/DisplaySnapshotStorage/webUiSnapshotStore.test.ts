/**
 * The write-behind half of the web/desktop UI snapshot store.
 *
 * A flush that fails re-queues its keys, and the tail that reschedules the
 * successor of a slow flush cannot tell the two apart by itself. Left
 * unbounded that pair reopens a permanently broken database for the life of
 * the page, which is a documented state — a private window, an exhausted
 * quota, IndexedDB blocked — not an exotic one.
 */
import { OneKeyLocalError } from '../../errors';

let openAttempts = 0;
let openShouldFail = true;
let putCalls: { key: string; value: string }[] = [];
let releaseTransaction: (() => void) | undefined;

jest.mock('../../IndexedDBPromised', () => ({
  IndexedDBPromised: class {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
    constructor(_options: unknown) {}

    async open() {
      openAttempts += 1;
      if (openShouldFail) {
        throw new OneKeyLocalError('indexeddb unavailable');
      }
    }

    async createBucketTransaction() {
      if (releaseTransaction) {
        await new Promise<void>((resolve) => {
          releaseTransaction = resolve;
        });
      }
      return {
        objectStore: () => ({
          put: (value: string, key: string) => {
            putCalls.push({ key, value });
            return Promise.resolve();
          },
          delete: () => Promise.resolve(),
          clear: () => Promise.resolve(),
        }),
        done: Promise.resolve(),
      };
    }
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  __resetWebUiSnapshotStoreForTests,
  createWebUiSnapshotSyncBackend,
  flushUiSnapshotStoreNow,
} =
  require('./webUiSnapshotStore') as typeof import('./webUiSnapshotStore');

const FLUSH_DEBOUNCE_MS = 2000;
// One first attempt plus the retries the store allows before it goes quiet.
const MAX_OPEN_ATTEMPTS_PER_WRITE = 4;

/** Let the flush's own promise chain settle between timer steps. */
async function settle() {
  for (let i = 0; i < 8; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

describe('webUiSnapshotStore write-behind', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    openAttempts = 0;
    openShouldFail = true;
    putCalls = [];
    releaseTransaction = undefined;
    __resetWebUiSnapshotStoreForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops reopening a database that never comes back', async () => {
    const backend = createWebUiSnapshotSyncBackend('ctx-atom-snapshot');
    backend.commit({
      entries: [{ key: 'a', value: 'first' }],
      commitMarker: { key: 'manifest', value: 'm1' },
    });

    // Far more wake-ups than the cap, with no further writes.
    for (let i = 0; i < 20; i += 1) {
      jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS * 4);
      // eslint-disable-next-line no-await-in-loop
      await settle();
    }

    expect(openAttempts).toBeGreaterThan(0);
    expect(openAttempts).toBeLessThanOrEqual(MAX_OPEN_ATTEMPTS_PER_WRITE);
  });

  it('tries again once a real write arrives', async () => {
    const backend = createWebUiSnapshotSyncBackend('ctx-atom-snapshot');
    backend.commit({
      entries: [{ key: 'a', value: 'first' }],
      commitMarker: { key: 'manifest', value: 'm1' },
    });
    for (let i = 0; i < 20; i += 1) {
      jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS * 4);
      // eslint-disable-next-line no-await-in-loop
      await settle();
    }
    const attemptsAfterGivingUp = openAttempts;

    backend.commit({
      entries: [{ key: 'b', value: 'second' }],
      commitMarker: { key: 'manifest', value: 'm2' },
    });
    jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS);
    await settle();

    expect(openAttempts).toBeGreaterThan(attemptsAfterGivingUp);
  });

  it('keeps an explicit flush waiting for the key written after it started', async () => {
    openShouldFail = false;
    const backend = createWebUiSnapshotSyncBackend('ctx-atom-snapshot');
    backend.commit({
      entries: [{ key: 'a', value: 'first' }],
      commitMarker: { key: 'manifest', value: 'm1' },
    });

    // Hold the first flush inside its transaction.
    releaseTransaction = () => undefined;
    jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS);
    await settle();

    // Written after that flush took its key list, so it is not in it.
    backend.commit({
      entries: [{ key: 'b', value: 'second' }],
      commitMarker: { key: 'manifest', value: 'm2' },
    });
    const explicit = flushUiSnapshotStoreNow();

    // Let the first flush finish, but never advance the debounce timer: the
    // only thing that can persist `b` before `explicit` resolves is the
    // explicit flush itself.
    releaseTransaction?.();
    releaseTransaction = undefined;
    await explicit;

    expect(
      putCalls.some(
        ({ key, value }) =>
          key === 'ctx-atom-snapshot:b' && value === 'second',
      ),
    ).toBe(true);
  });
});
