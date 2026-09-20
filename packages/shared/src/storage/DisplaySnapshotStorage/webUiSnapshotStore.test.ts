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

// The node test environment has no IndexedDB globals, and the store only
// needs the range object to hand to its object store.
const globalWithKeyRange = globalThis as unknown as {
  IDBKeyRange?: {
    bound: (lower: string, upper: string) => { lower: string; upper: string };
  };
};
globalWithKeyRange.IDBKeyRange ??= {
  bound: (lower: string, upper: string) => ({ lower, upper }),
};

function describeDeleteTarget(target: unknown) {
  if (typeof target === 'string') {
    return target;
  }
  const range = target as { lower: string; upper: string };
  return `range:${range.lower}..${range.upper}`;
}

let openAttempts = 0;
let openShouldFail = true;
let putCalls: { key: string; value: string }[] = [];
let deleteCalls: string[] = [];
/** Puts and deletes in the order the store issued them. */
let operations: string[] = [];
/** Stands in for an exhausted quota: only the transaction that asks to run
 *  when storage is full gets through. */
let quotaRejectsWrites = false;
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

    async createBucketTransaction(
      _storeNames: unknown,
      _mode: unknown,
      options?: { allowWhenStorageFull?: boolean },
    ) {
      if (quotaRejectsWrites && !options?.allowWhenStorageFull) {
        throw new OneKeyLocalError('disk is full');
      }
      if (releaseTransaction) {
        await new Promise<void>((resolve) => {
          releaseTransaction = resolve;
        });
      }
      return {
        objectStore: () => ({
          put: (value: string, key: string) => {
            putCalls.push({ key, value });
            operations.push(`put:${key}`);
            return Promise.resolve();
          },
          delete: (key: unknown) => {
            deleteCalls.push(describeDeleteTarget(key));
            operations.push(`delete:${describeDeleteTarget(key)}`);
            return Promise.resolve();
          },
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
  primeWebUiSnapshotStore,
} = require('./webUiSnapshotStore') as typeof import('./webUiSnapshotStore');

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
    deleteCalls = [];
    operations = [];
    quotaRejectsWrites = false;
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
        ({ key, value }) => key === 'ctx-atom-snapshot:b' && value === 'second',
      ),
    ).toBe(true);
  });

  it('deletes even when the quota rejected the write in the same batch', async () => {
    openShouldFail = false;
    quotaRejectsWrites = true;
    // One queue serves every namespace, so a put and a delete from two of
    // them share a batch — which is the case a full quota has to survive.
    const writer = createWebUiSnapshotSyncBackend('ctx-atom-snapshot');
    const sweeper = createWebUiSnapshotSyncBackend('market-token-detail');
    writer.commit({
      entries: [{ key: 'a', value: 'first' }],
      commitMarker: { key: 'manifest', value: 'm1' },
    });
    sweeper.remove(['stale']);

    await flushUiSnapshotStoreNow();

    expect(putCalls).toHaveLength(0);
    expect(deleteCalls).toEqual(['market-token-detail:stale']);

    // Only the rejected write is queued again: the delete already landed, so
    // retrying it would spend the store's attempts on a record that is gone.
    quotaRejectsWrites = false;
    jest.advanceTimersByTime(FLUSH_DEBOUNCE_MS);
    await settle();

    expect(putCalls.map(({ key }) => key).toSorted()).toEqual([
      'ctx-atom-snapshot:a',
      'ctx-atom-snapshot:manifest',
    ]);
    expect(deleteCalls).toEqual(['market-token-detail:stale']);
  });

  it('clears a namespace on disk, including records it never read', async () => {
    openShouldFail = false;
    const backend = createWebUiSnapshotSyncBackend('swr-wallet-list');
    // Nothing primed this namespace, so the map names none of its records —
    // which is the case the wallet deletion has to survive.
    backend.clearNamespace();

    await flushUiSnapshotStoreNow();

    expect(deleteCalls).toEqual(['range:swr-wallet-list:..swr-wallet-list;']);
  });

  it('clears the namespace before the writes queued after it', async () => {
    openShouldFail = false;
    const backend = createWebUiSnapshotSyncBackend('swr-wallet-list');
    backend.clearNamespace();
    backend.commit({
      entries: [{ key: 'd:wallet-2', value: 'fresh' }],
      commitMarker: { key: 'manifest', value: 'm1' },
    });

    await flushUiSnapshotStoreNow();

    expect(operations).toEqual([
      'delete:range:swr-wallet-list:..swr-wallet-list;',
      'put:swr-wallet-list:d:wallet-2',
      'put:swr-wallet-list:manifest',
    ]);
  });

  it('does not prime back a namespace this session cleared', () => {
    openShouldFail = false;
    const cleared = createWebUiSnapshotSyncBackend('swr-wallet-list');
    const untouched = createWebUiSnapshotSyncBackend('swr-market-token-detail');
    cleared.clearNamespace();

    // The startup read began before the clear and lands after it.
    primeWebUiSnapshotStore([
      ['swr-wallet-list:d:wallet-1', 'stale'],
      ['swr-market-token-detail:d:btc', 'unrelated'],
    ]);

    expect(cleared.read('d:wallet-1')).toBeUndefined();
    expect(untouched.read('d:btc')).toBe('unrelated');
  });
});
