import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { INativeStorageContractViolation } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import {
  NATIVE_STORAGE_CONTRACT_VIOLATION_KEY_PREFIX,
  deletePersistedNativeStorageContractViolation,
  drainPersistedNativeStorageContractViolations,
  persistNativeStorageContractViolation,
  readPersistedNativeStorageContractViolations,
} from './nativeStorageContractViolationQueue';

function createStore() {
  const values = new Map<string, string | number | boolean>();
  return {
    delete: (key: string) => values.delete(key),
    get: (key: string) => values.get(key),
    keys: () => [...values.keys()],
    set: (key: string, value: string | number | boolean) => {
      values.set(key, value);
    },
    values,
  };
}

function createViolation(id: string): INativeStorageContractViolation {
  return {
    apiName: 'unsupportedAPI',
    id,
    message: 'unsupported API',
    runtime: 'background',
  };
}

describe('nativeStorageContractViolationQueue', () => {
  it('persists violations independently and deletes the acknowledged id', () => {
    const store = createStore();
    const first = createViolation('background:1');
    const second = createViolation('background:2');

    expect(persistNativeStorageContractViolation(store, first)).toBe(true);
    expect(persistNativeStorageContractViolation(store, second)).toBe(true);
    expect(
      readPersistedNativeStorageContractViolations(store).entries.map(
        (entry) => entry.violation,
      ),
    ).toEqual([first, second]);

    deletePersistedNativeStorageContractViolation(store, first.id);

    expect(
      readPersistedNativeStorageContractViolations(store).entries.map(
        (entry) => entry.violation,
      ),
    ).toEqual([second]);
  });

  it('keeps a violation when main dispatch fails and retries it later', () => {
    const store = createStore();
    const violation = createViolation('background:fatal');
    persistNativeStorageContractViolation(store, violation);

    expect(
      drainPersistedNativeStorageContractViolations(store, () => {
        throw new OneKeyLocalError('main handler unavailable');
      }),
    ).toBe(0);
    expect(readPersistedNativeStorageContractViolations(store).entries).toEqual(
      [expect.objectContaining({ violation })],
    );

    const listener = jest.fn();
    expect(drainPersistedNativeStorageContractViolations(store, listener)).toBe(
      1,
    );
    expect(listener).toHaveBeenCalledWith(violation);
    expect(readPersistedNativeStorageContractViolations(store).entries).toEqual(
      [],
    );
  });

  it('bounds the native queue and removes malformed entries', () => {
    const store = createStore();
    store.set(`${NATIVE_STORAGE_CONTRACT_VIOLATION_KEY_PREFIX}invalid`, '{');
    for (let index = 0; index < 25; index += 1) {
      persistNativeStorageContractViolation(
        store,
        createViolation(`background:${String(index).padStart(2, '0')}`),
      );
    }

    const { entries, invalidKeys } =
      readPersistedNativeStorageContractViolations(store);
    expect(entries).toHaveLength(20);
    expect(entries[0].violation.id).toBe('background:05');
    expect(invalidKeys).toEqual([]);
  });
});
