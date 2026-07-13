import {
  buildLegacyWalletCreatedAtFallback,
  buildWalletCreatedAtISOString,
  resolveWalletCreatedAtForCreationRecord,
} from './creationRecordUtils';

describe('creationRecordUtils', () => {
  test('buildWalletCreatedAtISOString normalizes the provided timestamp', () => {
    expect(
      buildWalletCreatedAtISOString({
        now: 1_710_000_000_000,
      }),
    ).toBe('2024-03-09T16:00:00.000Z');
  });

  test('resolveWalletCreatedAtForCreationRecord prefers the cached timestamp', () => {
    expect(
      resolveWalletCreatedAtForCreationRecord({
        cachedWalletCreatedAt: '2026-04-01T00:00:00.000Z',
        deviceCreatedAt: 1_710_000_000_000,
      }),
    ).toBe('2026-04-01T00:00:00.000Z');
  });

  test('resolveWalletCreatedAtForCreationRecord falls back to the device timestamp', () => {
    expect(
      resolveWalletCreatedAtForCreationRecord({
        deviceCreatedAt: 1_710_000_000_000,
      }),
    ).toBe('2024-03-09T16:00:00.000Z');
  });

  test('resolveWalletCreatedAtForCreationRecord uses the legacy expired fallback', () => {
    expect(
      resolveWalletCreatedAtForCreationRecord({
        now: 1_710_000_000_000,
      }),
    ).toBe(
      buildLegacyWalletCreatedAtFallback({
        now: 1_710_000_000_000,
      }),
    );
  });
});
