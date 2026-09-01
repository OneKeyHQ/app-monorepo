import {
  compareAssetSnapshotMeta,
  getServerDateMsFromHeaders,
  isAssetSnapshotNewer,
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
});
