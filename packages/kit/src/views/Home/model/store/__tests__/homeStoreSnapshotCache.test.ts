import { getHomeSourceKeyIdentity } from '../../core/homeIdentity';
import {
  HOME_STORE_CACHE_MAX_BYTES,
  HOME_STORE_CACHE_MAX_RECORDS,
  HOME_STORE_CACHE_MAX_ROWS,
  decodeHomeStoreSnapshot,
  encodeHomeStoreSnapshot,
  isHomeCachedRecordExactForToken,
} from '../homeStoreSnapshotCodec';

import type { IHomeCachedSourceRecord } from '../homeStoreTypes';

const createdAt = 1000;
const expiresAt = 10_000;

function record(
  overrides: Partial<IHomeCachedSourceRecord> = {},
): IHomeCachedSourceRecord {
  return {
    sourceId: 'defi',
    sourceKeyIdentity: 'defi-owner-a',
    dataSchemaVersion: 1,
    coverageFingerprint: '["row-a"]',
    quoteBasis: null,
    confirmedAt: createdAt,
    expiresAt,
    payload: {
      payload: { rows: [{ id: 'row-a' }] },
      section: {
        kind: 'ready',
        rowIds: ['row-a'],
        freshness: 'live',
        refresh: 'idle',
      },
    },
    ...overrides,
  };
}

describe('Home Store snapshot cache codec', () => {
  it('round-trips a valid owner-scoped opaque payload', () => {
    const envelope = encodeHomeStoreSnapshot({
      key: 'home-store-owner-a',
      ownerScopeKey: 'owner-a',
      records: [record()],
      createdAt,
      expiresAt,
    });
    expect(envelope).toBeDefined();
    expect(
      decodeHomeStoreSnapshot({
        envelope,
        expectedOwnerScopeKey: 'owner-a',
        now: createdAt + 1,
      }),
    ).toMatchObject({
      ownerScopeKey: 'owner-a',
      records: [{ sourceId: 'defi' }],
    });
  });

  it('rejects wrong-owner, expired, sensitive, and oversized snapshots', () => {
    const envelope = encodeHomeStoreSnapshot({
      key: 'home-store-owner-a',
      ownerScopeKey: 'owner-a',
      records: [record()],
      createdAt,
      expiresAt,
    });
    expect(
      decodeHomeStoreSnapshot({
        envelope,
        expectedOwnerScopeKey: 'owner-b',
        now: createdAt + 1,
      }),
    ).toBeUndefined();
    expect(
      decodeHomeStoreSnapshot({
        envelope,
        expectedOwnerScopeKey: 'owner-a',
        now: expiresAt,
      }),
    ).toBeUndefined();
    expect(
      encodeHomeStoreSnapshot({
        key: 'home-store-owner-a',
        ownerScopeKey: 'owner-a',
        records: [record({ payload: { mnemonic: 'forbidden' } })],
        createdAt,
        expiresAt,
      }),
    ).toBeUndefined();
    expect(
      encodeHomeStoreSnapshot({
        key: 'home-store-owner-a',
        ownerScopeKey: 'owner-a',
        records: Array.from(
          { length: HOME_STORE_CACHE_MAX_RECORDS + 1 },
          (_, index) => record({ sourceKeyIdentity: `defi-owner-a-${index}` }),
        ),
        createdAt,
        expiresAt,
      }),
    ).toBeUndefined();
  });

  it('rejects a record whose nested arrays exceed the row bound', () => {
    const itemCount = Math.floor(HOME_STORE_CACHE_MAX_ROWS / 2) + 1;
    const rowIds = Array.from(
      { length: itemCount },
      (_, index) => `row-${index}`,
    );
    expect(
      encodeHomeStoreSnapshot({
        key: 'home-store-owner-a',
        ownerScopeKey: 'owner-a',
        records: [
          record({
            coverageFingerprint: JSON.stringify(rowIds),
            payload: {
              rows: rowIds.map((id) => ({ id })),
              section: {
                kind: 'ready',
                rowIds,
                freshness: 'live',
                refresh: 'idle',
              },
            },
          }),
        ],
        createdAt,
        expiresAt,
      }),
    ).toBeUndefined();
  });

  it('rejects an encoded payload beyond the byte bound', () => {
    expect(
      encodeHomeStoreSnapshot({
        key: 'home-store-owner-a',
        ownerScopeKey: 'owner-a',
        records: [
          record({
            payload: {
              padding: 'x'.repeat(HOME_STORE_CACHE_MAX_BYTES),
              section: {
                kind: 'ready',
                rowIds: ['row-a'],
                freshness: 'live',
                refresh: 'idle',
              },
            },
          }),
        ],
        createdAt,
        expiresAt,
      }),
    ).toBeUndefined();
  });

  it('rejects the whole envelope when one record is invalid', () => {
    const envelope = encodeHomeStoreSnapshot({
      key: 'home-store-owner-a',
      ownerScopeKey: 'owner-a',
      records: [record()],
      createdAt,
      expiresAt,
    });
    expect(envelope).toBeDefined();
    if (!envelope) {
      return;
    }
    const decodedPayload = JSON.parse(envelope.payload) as {
      records: IHomeCachedSourceRecord[];
    };
    decodedPayload.records.push(record({ expiresAt: createdAt }));
    expect(
      decodeHomeStoreSnapshot({
        envelope: { ...envelope, payload: JSON.stringify(decodedPayload) },
        expectedOwnerScopeKey: 'owner-a',
        now: createdAt + 1,
      }),
    ).toBeUndefined();
  });

  it('admits a record only for the exact source, schema, quote, and coverage contract', () => {
    const token = {
      protocolVersion: 1 as const,
      clientInstanceId: 'client-a',
      producerInstanceId: 'producer-a',
      sessionId: 'session-a',
      requestSeq: 1,
      sourceKey: {
        scopeKey: 'owner-a',
        sourceId: 'defi' as const,
        paramsFingerprint: 'params-a',
        dataSchemaVersion: 2,
        quoteBasis: { currency: 'USD', pricingRevision: 'rates-a' },
      },
    };
    const exact = record({
      sourceKeyIdentity: getHomeSourceKeyIdentity(token.sourceKey),
      dataSchemaVersion: 2,
      coverageFingerprint: '["row-a"]',
      quoteBasis: token.sourceKey.quoteBasis,
      payload: {
        section: {
          kind: 'ready',
          rowIds: ['row-a'],
          freshness: 'live',
          refresh: 'idle',
        },
      },
    });
    expect(isHomeCachedRecordExactForToken(exact, token)).toBe(true);
    expect(
      isHomeCachedRecordExactForToken(
        { ...exact, dataSchemaVersion: 1 },
        token,
      ),
    ).toBe(false);
    expect(
      isHomeCachedRecordExactForToken(
        {
          ...exact,
          quoteBasis: { currency: 'USD', pricingRevision: 'rates-b' },
        },
        token,
      ),
    ).toBe(false);
    expect(
      isHomeCachedRecordExactForToken(
        { ...exact, coverageFingerprint: '["row-b"]' },
        token,
      ),
    ).toBe(false);
  });
});
