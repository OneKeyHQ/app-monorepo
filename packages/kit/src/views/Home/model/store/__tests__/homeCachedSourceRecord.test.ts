import { getHomeSourceKeyIdentity } from '../../core/homeIdentity';
import {
  createHomeCachedSourceRecord,
  isHomeCachedRecordExactForToken,
} from '../homeCachedSourceRecord';

import type { IHomeCachedSourceRecord } from '../homeStoreTypes';

describe('Home cached source record', () => {
  it('admits a record only for the exact source, schema, quote, and coverage', () => {
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
    const exact: IHomeCachedSourceRecord = {
      sourceId: 'defi',
      sourceKeyIdentity: getHomeSourceKeyIdentity(token.sourceKey),
      dataSchemaVersion: 2,
      coverageFingerprint: '1:row-a:row-a',
      quoteBasis: token.sourceKey.quoteBasis,
      confirmedAt: 1000,
      expiresAt: 10_000,
      payload: {
        section: {
          kind: 'ready',
          rowIds: ['row-a'],
        },
      },
    };

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
        { ...exact, coverageFingerprint: '1:row-b:row-b' },
        token,
      ),
    ).toBe(false);
  });

  it('persists only explicitly confirmed empty sections', () => {
    const token = {
      protocolVersion: 1 as const,
      clientInstanceId: 'client-a',
      producerInstanceId: 'producer-a',
      sessionId: 'session-a',
      requestSeq: 1,
      sourceKey: {
        scopeKey: 'owner-a',
        sourceId: 'portfolio' as const,
        paramsFingerprint: 'params-a',
        dataSchemaVersion: 2,
      },
    };

    expect(
      createHomeCachedSourceRecord({
        now: 1000,
        sourceId: 'portfolio',
        slot: {
          kind: 'empty',
          token,
          coverageFingerprint: 'empty:v2',
          freshness: 'live',
          refresh: 'idle',
        },
      }),
    ).toBeUndefined();

    const confirmed = createHomeCachedSourceRecord({
      now: 1000,
      sourceId: 'portfolio',
      slot: {
        kind: 'empty',
        token,
        coverageFingerprint: 'confirmed-empty:portfolio:v1',
        freshness: 'live',
        refresh: 'idle',
      },
    });
    expect(confirmed).toMatchObject({
      coverageFingerprint: 'confirmed-empty:portfolio:v1',
      dataSchemaVersion: 2,
      payload: { section: { kind: 'empty' } },
      sourceId: 'portfolio',
    });
    expect(confirmed && isHomeCachedRecordExactForToken(confirmed, token)).toBe(
      true,
    );
  });
});
