import { EInviteCodeAttributionSource } from '@onekeyhq/shared/src/referralCode/installReferrerUtils';

import { SimpleDbEntityReferralCode } from './SimpleDbEntityReferralCode';

import type {
  IInstallReferralRecord,
  IReferralCodeData,
} from './SimpleDbEntityReferralCode';

const NOW = 1_780_000_000_000;

function buildRecord(
  overrides: Partial<IInstallReferralRecord> = {},
): IInstallReferralRecord {
  return {
    code: 'ABC123',
    source: EInviteCodeAttributionSource.androidInstallReferrer,
    attributedAt: NOW - 1000,
    createdAt: NOW - 1000,
    ttlDays: 999,
    ...overrides,
  };
}

// Runs each write's builder against in-memory data, the way `setRawData` does
// under its mutex, so both the read-modify-write and the flag the method sets
// inside the builder are exercised for real.
function createEntity(initial: IReferralCodeData) {
  const entity = new SimpleDbEntityReferralCode();
  let stored: IReferralCodeData | undefined = initial;
  jest.spyOn(entity, 'setRawData').mockImplementation(async (dataOrBuilder) => {
    stored =
      typeof dataOrBuilder === 'function'
        ? await dataOrBuilder(stored)
        : dataOrBuilder;
    return stored;
  });
  return { entity, getStored: () => stored };
}

describe('SimpleDbEntityReferralCode.markInstallReferralConsumedIfMatches', () => {
  it('remembers a bind made before the native code is captured', async () => {
    const { entity, getStored } = createEntity({ myReferralCode: '' });

    await expect(
      entity.markInstallReferralConsumedIfMatches({ code: 'ABC123', now: NOW }),
    ).resolves.toBe(false);
    expect(getStored()?.installReferral).toBeUndefined();
    expect(getStored()?.pendingBoundReferralCodes).toEqual({
      abc123: NOW,
    });

    await entity.setInstallReferral(buildRecord());
    expect(getStored()?.installReferral?.consumedAt).toBe(NOW);
    expect(getStored()?.pendingBoundReferralCodes).toBeUndefined();
  });

  it('keeps a consumed code retired if capture repeats', async () => {
    const { entity, getStored } = createEntity({
      myReferralCode: '',
      installReferral: buildRecord({ consumedAt: NOW }),
      installReferralCaptureResolved: true,
    });

    await entity.setInstallReferral(buildRecord());
    expect(getStored()?.installReferral?.consumedAt).toBe(NOW);
  });

  it('returns false and keeps the original consumedAt when already consumed', async () => {
    const record = buildRecord({ consumedAt: NOW - 500 });
    const { entity, getStored } = createEntity({
      myReferralCode: '',
      installReferral: record,
    });

    await expect(
      entity.markInstallReferralConsumedIfMatches({ code: 'ABC123', now: NOW }),
    ).resolves.toBe(false);
    expect(getStored()?.installReferral).toEqual(record);
  });

  it('returns false and leaves the record untouched for a different code', async () => {
    const record = buildRecord();
    const { entity, getStored } = createEntity({
      myReferralCode: '',
      installReferral: record,
    });

    await expect(
      entity.markInstallReferralConsumedIfMatches({ code: 'OTHER1', now: NOW }),
    ).resolves.toBe(false);
    expect(getStored()?.installReferral).toEqual(record);
  });

  it('consumes an exact match without dropping any stored data', async () => {
    const record = buildRecord();
    const initial: IReferralCodeData = {
      myReferralCode: 'MINE',
      cachedInviteCode: 'DRAFT',
      installReferral: record,
    };
    const { entity, getStored } = createEntity(initial);

    await expect(
      entity.markInstallReferralConsumedIfMatches({ code: 'ABC123', now: NOW }),
    ).resolves.toBe(true);
    expect(getStored()).toEqual({
      ...initial,
      installReferral: { ...record, consumedAt: NOW },
    });
  });

  it('consumes a match that differs only in case', async () => {
    const { entity, getStored } = createEntity({
      myReferralCode: '',
      installReferral: buildRecord({ code: 'ABC123' }),
    });

    await expect(
      entity.markInstallReferralConsumedIfMatches({ code: 'abc123', now: NOW }),
    ).resolves.toBe(true);
    expect(getStored()?.installReferral?.consumedAt).toBe(NOW);
  });

  it('returns false when persistence never runs the write', async () => {
    const entity = new SimpleDbEntityReferralCode();
    // Masked persistence resolves without invoking the builder at all.
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);

    await expect(
      entity.markInstallReferralConsumedIfMatches({ code: 'ABC123', now: NOW }),
    ).resolves.toBe(false);
  });
});

describe('SimpleDbEntityReferralCode pending fresh install', () => {
  it('is remembered while pending and cleared once a code is stored', async () => {
    const { entity, getStored } = createEntity({ myReferralCode: '' });

    await entity.markInstallReferralPendingFreshInstall();
    expect(getStored()?.installReferralPendingFreshInstall).toBe(true);

    await entity.setInstallReferral(buildRecord());
    expect(getStored()?.installReferralPendingFreshInstall).toBeUndefined();
    expect(getStored()?.installReferralCaptureResolved).toBe(true);
  });

  it('is cleared when the capture resolves without a code', async () => {
    const { entity, getStored } = createEntity({
      myReferralCode: '',
      installReferralPendingFreshInstall: true,
    });

    await entity.markInstallReferralCaptureResolved();
    expect(getStored()?.installReferralPendingFreshInstall).toBeUndefined();
    expect(getStored()?.installReferralCaptureResolved).toBe(true);
  });
});
