import {
  adaptHomeSectionSourceState,
  createHomeSectionConfirmedSeed,
} from '../sections/homeSectionSourceAdapter';

const identity = {
  owner: { scopeKey: 'owner-1', sessionId: 'session-1' },
  sectionId: 'portfolio' as const,
  sourceId: 'portfolio' as const,
  sourceKeyIdentity: 'portfolio-source-1',
  producerInstanceId: 'producer-1',
  sourceRevision: 1,
};

describe('homeSectionSourceAdapter', () => {
  it('maps idle, loading, and partial source states to loading events', () => {
    expect(
      adaptHomeSectionSourceState({
        identity,
        state: { status: 'idle', requestSeq: 0 },
        getRowIds: (data: { rows: { id: string }[] }) =>
          data.rows.map((row) => row.id),
      }),
    ).toMatchObject({ kind: 'loading', requestSeq: 0 });
    expect(
      adaptHomeSectionSourceState({
        identity,
        state: {
          status: 'partial',
          requestSeq: 1,
          data: { rows: [{ id: 'partial' }] },
          coverageFingerprint: 'partial-1',
        },
        getRowIds: (data) => data.rows.map((row) => row.id),
      }),
    ).toMatchObject({ kind: 'partial', coverageFingerprint: 'partial-1' });
  });

  it('preserves live payload only for complete success', () => {
    expect(
      adaptHomeSectionSourceState({
        identity,
        state: {
          status: 'success',
          requestSeq: 2,
          data: { rows: [{ id: 'row-1' }] },
          coverageFingerprint: 'complete-1',
        },
        getRowIds: (data) => data.rows.map((row) => row.id),
      }),
    ).toMatchObject({
      kind: 'complete',
      result: { kind: 'success', rowIds: ['row-1'] },
    });
  });

  it('creates a lossless confirmed seed for a main-owned payload', () => {
    const data = {
      rows: [{ id: 'cached-row' }],
      formatter: () => 'main-only',
    };
    const event = createHomeSectionConfirmedSeed({
      data,
      getRowIds: (value) => value.rows.map((row) => row.id),
      identity,
      refresh: 'refreshing',
      requestSeq: 1,
    });
    expect(event).toMatchObject({
      kind: 'seedConfirmed',
      rowIds: ['cached-row'],
      refresh: 'refreshing',
    });
    if (event.kind === 'seedConfirmed') {
      expect(event.data).toBe(data);
    }
  });
});
