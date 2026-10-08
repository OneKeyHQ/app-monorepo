import {
  UNREADABLE_SELF_HEAL_MAX_RETRIES,
  getUnreadableSelfHealDelayMs,
  retryUnreadableStorageRead,
} from './retryUnreadableStorageRead';

/*
yarn jest packages/kit-bg/src/dbs/simple/base/retryUnreadableStorageRead.test.ts
*/

describe('retryUnreadableStorageRead', () => {
  test('uses exponential backoff delays then deletes', async () => {
    const waits: number[] = [];
    const phases: string[] = [];
    const read = jest.fn(async () => {
      const error = new Error('Failed to read large IndexedDB value');
      error.name = 'UnknownError';
      throw error;
    });
    const onDelete = jest.fn(async () => undefined);

    await expect(
      retryUnreadableStorageRead({
        read,
        shouldDelete: () => true,
        onDelete,
        errorMeta: {
          errorName: 'UnknownError',
          errorMessage: 'Failed to read large IndexedDB value',
        },
        wait: async (ms) => {
          waits.push(ms);
        },
        log: (entry) => {
          phases.push(entry.phase);
          expect(entry.errorName).toBe('UnknownError');
          expect(entry.errorMessage).toBe(
            'Failed to read large IndexedDB value',
          );
        },
      }),
    ).resolves.toBeNull();

    expect(read).toHaveBeenCalledTimes(UNREADABLE_SELF_HEAL_MAX_RETRIES);
    expect(waits).toEqual(
      Array.from({ length: UNREADABLE_SELF_HEAL_MAX_RETRIES }, (_, i) =>
        getUnreadableSelfHealDelayMs(i),
      ),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(phases).toEqual([
      ...Array(UNREADABLE_SELF_HEAL_MAX_RETRIES).fill('retry'),
      'deleted',
    ]);
  });

  test('returns the value when a later retry succeeds', async () => {
    let attempts = 0;
    const onDelete = jest.fn();
    const result = await retryUnreadableStorageRead({
      read: async () => {
        attempts += 1;
        if (attempts < 2) {
          const error = new Error('Failed to read large IndexedDB value');
          error.name = 'UnknownError';
          throw error;
        }
        return 'ok';
      },
      shouldDelete: () => true,
      onDelete,
      errorMeta: {
        errorName: 'UnknownError',
        errorMessage: 'Failed to read large IndexedDB value',
      },
      wait: async () => undefined,
      log: () => undefined,
    });
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
