import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  buildPrimeAnalyticsProfileSnapshot,
  emitAnalyticsAfterDue,
  shouldDropStalePrimeProfileReport,
} from './primeAnalyticsProfile';

describe('buildPrimeAnalyticsProfileSnapshot', () => {
  it('reports never-logged-in users as false/false', () => {
    expect(
      buildPrimeAnalyticsProfileSnapshot({
        isLoggedIn: false,
        isLoggedInOnServer: false,
        isPrimeSubscriptionActive: true,
      }),
    ).toEqual({
      isOneKeyIdLoggedIn: false,
      isPrimeActive: false,
      profileKey: 'false:false',
    });
  });

  it('requires both local and server login flags before Prime can be active', () => {
    expect(
      buildPrimeAnalyticsProfileSnapshot({
        isLoggedIn: true,
        isLoggedInOnServer: true,
        isPrimeSubscriptionActive: true,
      }),
    ).toEqual({
      isOneKeyIdLoggedIn: true,
      isPrimeActive: true,
      profileKey: 'true:true',
    });
    expect(
      buildPrimeAnalyticsProfileSnapshot({
        isLoggedIn: true,
        isLoggedInOnServer: false,
        isPrimeSubscriptionActive: true,
      }).isPrimeActive,
    ).toBe(false);
  });
});

describe('shouldDropStalePrimeProfileReport', () => {
  it('keeps a snapshot that still matches the atom', () => {
    expect(
      shouldDropStalePrimeProfileReport({
        expectedKey: 'false:false',
        currentKey: 'false:false',
        lastHandledKey: 'false:false',
      }),
    ).toEqual({ drop: false, clearLastHandled: false });
  });

  it('drops a stale logged-out snapshot after login and clears only that key', () => {
    expect(
      shouldDropStalePrimeProfileReport({
        expectedKey: 'false:false',
        currentKey: 'true:true',
        lastHandledKey: 'false:false',
      }),
    ).toEqual({ drop: true, clearLastHandled: true });
  });

  it('does not clear a newer in-memory key owned by a later report', () => {
    expect(
      shouldDropStalePrimeProfileReport({
        expectedKey: 'false:false',
        currentKey: 'true:true',
        lastHandledKey: 'true:true',
      }),
    ).toEqual({ drop: true, clearLastHandled: false });
  });
});

describe('emitAnalyticsAfterDue', () => {
  it('persists only after emit succeeds', async () => {
    const emit = jest.fn(async () => undefined);
    const persist = jest.fn(async () => undefined);

    await expect(
      emitAnalyticsAfterDue({
        isDue: async () => true,
        emit,
        persist,
      }),
    ).resolves.toBe(true);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(emit.mock.invocationCallOrder[0]).toBeLessThan(
      persist.mock.invocationCallOrder[0],
    );
  });

  it('does not persist when emit throws', async () => {
    const persist = jest.fn(async () => undefined);

    await expect(
      emitAnalyticsAfterDue({
        isDue: async () => true,
        emit: async () => {
          throw new OneKeyLocalError('network failed');
        },
        persist,
      }),
    ).rejects.toThrow('network failed');
    expect(persist).not.toHaveBeenCalled();
  });

  it('skips emit and persist when the report is not due', async () => {
    const emit = jest.fn(async () => undefined);
    const persist = jest.fn(async () => undefined);

    await expect(
      emitAnalyticsAfterDue({
        isDue: async () => false,
        emit,
        persist,
      }),
    ).resolves.toBe(false);
    expect(emit).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
