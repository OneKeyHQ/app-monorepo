import {
  UNREADABLE_INDEXED_DB_VALUE_MESSAGE,
  isUnreadableStorageValueError,
} from './unreadableStorageValueError';

/*
yarn jest packages/kit-bg/src/dbs/simple/base/unreadableStorageValueError.test.ts
*/

describe('isUnreadableStorageValueError', () => {
  test('matches UnknownError with the exact Chromium blob message', () => {
    const error = new Error(UNREADABLE_INDEXED_DB_VALUE_MESSAGE);
    error.name = 'UnknownError';
    expect(isUnreadableStorageValueError(error)).toBe(true);
  });

  test('matches UnknownError when the message includes the fragment', () => {
    const error = new Error(
      `${UNREADABLE_INDEXED_DB_VALUE_MESSAGE} (disk full)`,
    );
    error.name = 'UnknownError';
    expect(isUnreadableStorageValueError(error)).toBe(true);
  });

  test('rejects NotReadableError even with the same message', () => {
    const error = new Error(UNREADABLE_INDEXED_DB_VALUE_MESSAGE);
    error.name = 'NotReadableError';
    expect(isUnreadableStorageValueError(error)).toBe(false);
  });

  test('rejects UnknownError without the fragment', () => {
    const error = new Error('Internal error opening backing store');
    error.name = 'UnknownError';
    expect(isUnreadableStorageValueError(error)).toBe(false);
  });
});
