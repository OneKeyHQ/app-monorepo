import {
  canApplyAssetSnapshotMeta,
  compareAssetSnapshotMeta,
  createAssetSnapshotMeta,
  getNewestAssetSnapshotMeta,
  getServerDateMsFromHeaders,
  isAssetSnapshotNewer,
  isAssetSnapshotSameOrNewer,
  normalizeAssetSnapshotMeta,
} from './assetSnapshotFreshness';

describe('assetSnapshotFreshness', () => {
  it('reads valid Date headers from common header shapes', () => {
    const expected = Date.parse('Tue, 01 Sep 2026 08:00:00 GMT');
    expect(
      getServerDateMsFromHeaders({ date: 'Tue, 01 Sep 2026 08:00:00 GMT' }),
    ).toBe(expected);
    expect(
      getServerDateMsFromHeaders({
        get: (name: string) =>
          name === 'date' ? 'Tue, 01 Sep 2026 08:00:00 GMT' : null,
      }),
    ).toBe(expected);
    expect(getServerDateMsFromHeaders({ date: 'not-a-date' })).toBeUndefined();
  });

  it('uses local sequence as a tie-breaker for equal server dates', () => {
    const serverDateMs = Date.parse('Tue, 01 Sep 2026 08:00:00 GMT');
    const older = { serverDateMs, localSeq: 1 };
    const newer = { serverDateMs, localSeq: 2 };
    expect(isAssetSnapshotNewer(newer, older)).toBe(true);
    expect(isAssetSnapshotNewer(older, newer)).toBe(false);
    expect(compareAssetSnapshotMeta(older, newer)).toBeLessThan(0);
  });

  it('keeps request order ahead of a later Date from a slow older response', () => {
    const olderResponseDate = Date.parse('Tue, 01 Sep 2026 08:00:01 GMT');
    const newerRequest = {
      localSeq: 2,
      serverDateMs: olderResponseDate - 1000,
    };
    const olderRequest = { localSeq: 1, serverDateMs: olderResponseDate };
    expect(isAssetSnapshotNewer(newerRequest, olderRequest)).toBe(true);
    expect(isAssetSnapshotNewer(olderRequest, newerRequest)).toBe(false);
  });

  it('uses the server Date only when request sequences are equal', () => {
    const older = {
      localSeq: 1,
      serverDateMs: Date.parse('Tue, 01 Sep 2026 08:00:00 GMT'),
    };
    const newer = {
      localSeq: 1,
      serverDateMs: Date.parse('Tue, 01 Sep 2026 08:00:01 GMT'),
    };
    expect(isAssetSnapshotNewer(newer, older)).toBe(true);
  });

  it('falls back to the local sequence when one response has no header', () => {
    expect(
      isAssetSnapshotNewer(
        { localSeq: 99 },
        { serverDateMs: Date.now(), localSeq: 1 },
      ),
    ).toBe(true);
  });

  it('treats malformed metadata as unversioned', () => {
    const malformed = { localSeq: Number.NaN };
    const versioned = { localSeq: 10 };
    expect(normalizeAssetSnapshotMeta(malformed)).toBeUndefined();
    expect(compareAssetSnapshotMeta(malformed, versioned)).toBeLessThan(0);
    expect(getNewestAssetSnapshotMeta(malformed, versioned)).toEqual(versioned);
  });

  it('lets a legacy write initialize an unversioned key but never clobber a versioned one', () => {
    expect(canApplyAssetSnapshotMeta(undefined, undefined)).toBe(true);
    expect(canApplyAssetSnapshotMeta(undefined, { localSeq: Number.NaN })).toBe(
      true,
    );
    expect(canApplyAssetSnapshotMeta(undefined, { localSeq: 1 })).toBe(false);
    expect(canApplyAssetSnapshotMeta({ localSeq: 2 }, { localSeq: 1 })).toBe(
      true,
    );
    expect(canApplyAssetSnapshotMeta({ localSeq: 1 }, { localSeq: 2 })).toBe(
      false,
    );
  });

  it('recovers the mint counter after observing a persisted future sequence (clock rollback)', () => {
    // Simulate a snapshot persisted by a previous session whose wall clock
    // was ahead of this session's seed.
    const futureSeq = Date.now() * 1000 + 10 ** 12;
    const persistedFutureMeta = { localSeq: futureSeq };

    // A freshly minted meta initially loses to the persisted future one …
    const before = createAssetSnapshotMeta();
    expect(isAssetSnapshotNewer(before, persistedFutureMeta)).toBe(false);

    // … but that comparison lifts the watermark, so the next minted meta
    // orders after the persisted snapshot and refreshes win again.
    const after = createAssetSnapshotMeta();
    expect(after.localSeq).toBeGreaterThan(futureSeq);
    expect(isAssetSnapshotNewer(after, persistedFutureMeta)).toBe(true);
  });

  it('admits an equal marker as same-or-newer but never an older or missing one', () => {
    const older = { localSeq: 1 };
    const same = { localSeq: 2 };
    const newer = { localSeq: 3 };
    expect(isAssetSnapshotSameOrNewer(same, same)).toBe(true);
    expect(isAssetSnapshotSameOrNewer(newer, same)).toBe(true);
    expect(isAssetSnapshotSameOrNewer(older, same)).toBe(false);
    expect(isAssetSnapshotSameOrNewer(undefined, same)).toBe(false);
    expect(isAssetSnapshotSameOrNewer(same, undefined)).toBe(true);
    expect(isAssetSnapshotSameOrNewer(undefined, undefined)).toBe(true);
  });
});
