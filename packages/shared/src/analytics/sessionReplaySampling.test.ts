import {
  REPLAY_BUCKET_COUNT,
  getReplayBucket,
  isReplaySampled,
} from './sessionReplaySampling';

function makeUuid(seed: number): string {
  // Deterministic pseudo-random canonical UUIDs (LCG) so the distribution
  // check does not depend on Math.random.
  let state = seed >>> 0;
  const nextHex = (length: number) => {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      out += (state >>> 28).toString(16);
    }
    return out;
  };
  return `${nextHex(8)}-${nextHex(4)}-7${nextHex(3)}-${nextHex(4)}-${nextHex(12)}`;
}

describe('getReplayBucket', () => {
  it('matches the HogQL golden vector', () => {
    expect(getReplayBucket('01890a5d-ac96-774b-bcce-0000deadbeef')).toBe(8559);
  });

  it('is case-insensitive', () => {
    expect(getReplayBucket('01890A5D-AC96-774B-BCCE-0000DEADBEEF')).toBe(8559);
  });

  it('uses only the last 8 hex digits', () => {
    expect(getReplayBucket('00000000-0000-7000-8000-000000000000')).toBe(0);
    expect(getReplayBucket('ffffffff-ffff-7fff-bfff-ffff00002710')).toBe(0);
    expect(getReplayBucket('ffffffff-ffff-7fff-bfff-ffff0000270f')).toBe(9999);
    expect(getReplayBucket('01890a5d-ac96-774b-bcce-0000ffffffff')).toBe(
      4_294_967_295 % REPLAY_BUCKET_COUNT,
    );
  });

  it.each([
    undefined,
    null,
    '',
    'not-a-uuid',
    '01890a5dac96774bbcce0000deadbeef',
    '01890a5d-ac96-774b-bcce-0000deadbeeg',
    '01890a5d-ac96-774b-bcce-0000deadbeef0',
    ' 01890a5d-ac96-774b-bcce-0000deadbeef',
  ])('returns undefined for malformed id %p', (sessionId) => {
    expect(getReplayBucket(sessionId)).toBeUndefined();
  });
});

describe('isReplaySampled', () => {
  it('compares the bucket against the threshold', () => {
    const id = '01890a5d-ac96-774b-bcce-0000deadbeef';
    expect(isReplaySampled(id, 8559)).toBe(false);
    expect(isReplaySampled(id, 8560)).toBe(true);
    expect(isReplaySampled(id, 0)).toBe(false);
    expect(isReplaySampled(id, REPLAY_BUCKET_COUNT)).toBe(true);
  });

  it('never samples with a zero, negative or non-finite threshold', () => {
    const id = '00000000-0000-7000-8000-000000000000';
    expect(isReplaySampled(id, 0)).toBe(false);
    expect(isReplaySampled(id, -1)).toBe(false);
    expect(isReplaySampled(id, Number.NaN)).toBe(false);
  });

  it('never samples malformed ids', () => {
    expect(isReplaySampled('garbage', REPLAY_BUCKET_COUNT)).toBe(false);
    expect(isReplaySampled(undefined, REPLAY_BUCKET_COUNT)).toBe(false);
  });

  it('samples about 3% of a fixed corpus at threshold 300', () => {
    const total = 20_000;
    let hits = 0;
    for (let i = 0; i < total; i += 1) {
      if (isReplaySampled(makeUuid(i + 1), 300)) {
        hits += 1;
      }
    }
    const rate = hits / total;
    expect(rate).toBeGreaterThan(0.028);
    expect(rate).toBeLessThan(0.032);
  });

  it('keeps a lower threshold a subset of a higher one', () => {
    for (let i = 0; i < 2000; i += 1) {
      const id = makeUuid(i + 7);
      if (isReplaySampled(id, 200)) {
        expect(isReplaySampled(id, 300)).toBe(true);
      }
    }
  });
});
