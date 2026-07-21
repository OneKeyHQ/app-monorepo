import { adaptHomeSectionRenderState } from '../compatibility/homeSectionRenderStateAdapter';
import { createReplaceSectionChange } from '../native/homeNativeDTOAdapter';
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

  it('never treats ready semantic without authoritative payload as ready render data', () => {
    expect(
      adaptHomeSectionRenderState({
        accepted: true,
        semantic: {
          kind: 'ready',
          rowIds: ['row-1'],
          freshness: 'live',
          refresh: 'idle',
        },
        authoritative: { kind: 'none' },
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('preserves confirmed refresh state for compatibility renderers', () => {
    const data = { rows: [{ id: 'cached-row' }] };
    expect(
      adaptHomeSectionRenderState({
        accepted: true,
        semantic: {
          kind: 'ready',
          rowIds: ['cached-row'],
          freshness: 'confirmedCache',
          refresh: 'refreshing',
        },
        authoritative: { kind: 'confirmedCache', data },
      }),
    ).toEqual({
      kind: 'ready',
      data,
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });
  });

  it('creates replaceSection only from an authoritative concrete section', () => {
    const section = { id: 'portfolio-assets', items: [] };
    expect(
      createReplaceSectionChange({ index: 0, section, tabId: 'portfolio' }),
    ).toEqual({
      kind: 'replaceSection',
      tabId: 'portfolio',
      sectionId: 'portfolio-assets',
      index: 0,
      value: section,
    });
  });
});
