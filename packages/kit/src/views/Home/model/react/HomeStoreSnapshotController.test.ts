import { getHomeSourceKeyIdentity } from '../core/homeIdentity';
import { isHomeCachedRecordExactForToken } from '../store/homeStoreSnapshotCodec';
import { createCacheRecord } from '../store/homeStoreSnapshotRecord';

import type { IHomeStoreResourceSlot } from '../store/homeStoreTypes';

const token = {
  protocolVersion: 1 as const,
  clientInstanceId: 'client-a',
  producerInstanceId: 'producer-a',
  sessionId: 'session-a',
  requestSeq: 1,
  sourceKey: {
    scopeKey: 'owner-a',
    sourceId: 'history' as const,
    paramsFingerprint: 'history-params-a',
    dataSchemaVersion: 2,
    quoteBasis: { currency: 'USD', pricingRevision: 'rates-a' },
  },
};

const liveSlot = {
  kind: 'ready',
  token,
  data: {
    payload: { addressMap: {}, data: [], tokenMap: {} },
    section: {
      kind: 'ready',
      rowIds: [],
      freshness: 'live',
      refresh: 'idle',
    },
  },
  coverageFingerprint: '[]',
  freshness: 'live',
  refresh: 'idle',
} satisfies IHomeStoreResourceSlot<{
  payload: {
    addressMap: Record<string, never>;
    data: [];
    tokenMap: Record<string, never>;
  };
  section: {
    kind: 'ready';
    rowIds: [];
    freshness: 'live';
    refresh: 'idle';
  };
}>;

describe('HomeStoreSnapshotController cache admission', () => {
  it('persists only a token-backed live slot with the exact request contract', () => {
    const record = createCacheRecord({
      now: 100,
      slot: liveSlot,
      sourceId: 'history',
    });

    expect(record).toMatchObject({
      sourceId: 'history',
      sourceKeyIdentity: getHomeSourceKeyIdentity(token.sourceKey),
      dataSchemaVersion: 2,
      coverageFingerprint: '[]',
      quoteBasis: { currency: 'USD', pricingRevision: 'rates-a' },
      confirmedAt: 100,
    });
    expect(record && isHomeCachedRecordExactForToken(record, token)).toBe(true);
  });

  it('rejects legacy or hydrated display state without a live request token', () => {
    expect(
      createCacheRecord({
        now: 100,
        slot: { ...liveSlot, token: undefined },
        sourceId: 'history',
      }),
    ).toBeUndefined();
    expect(
      createCacheRecord({
        now: 100,
        slot: { ...liveSlot, freshness: 'confirmedCache' },
        sourceId: 'history',
      }),
    ).toBeUndefined();
  });
});
