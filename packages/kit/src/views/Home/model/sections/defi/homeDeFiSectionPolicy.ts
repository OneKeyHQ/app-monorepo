import type {
  IHomeDeFiLegacyPayload,
  IHomeDeFiSourceSnapshot,
} from './homeDeFiSourceAdapter';

type IHomeDeFiEvidence =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: IHomeDeFiLegacyPayload;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | { kind: 'partial'; coverageFingerprint: string }
  | {
      kind: 'complete';
      confirmedEmpty: boolean;
      coverageFingerprint: string;
      data: IHomeDeFiLegacyPayload | undefined;
      rowIds: readonly string[];
    }
  | {
      kind: 'error';
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    };

function projectHomeDeFiSectionSource({
  authorityReady,
  evidence,
  requestSeq,
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeDeFiEvidence;
  requestSeq: number;
  scopeMatches: boolean;
}): IHomeDeFiSourceSnapshot {
  if (!authorityReady || !scopeMatches) {
    return { kind: 'loading', requestSeq };
  }
  switch (evidence.kind) {
    case 'loading':
      return { kind: 'loading', requestSeq };
    case 'confirmedCache':
      return { ...evidence, requestSeq };
    case 'partial':
      return { ...evidence, requestSeq };
    case 'error':
      return { ...evidence, requestSeq };
    case 'complete':
      if (evidence.confirmedEmpty) {
        return {
          kind: 'complete',
          requestSeq,
          coverageFingerprint: evidence.coverageFingerprint,
          result: { kind: 'empty' },
        };
      }
      if (!evidence.data || evidence.rowIds.length === 0) {
        return { kind: 'loading', requestSeq };
      }
      return {
        kind: 'complete',
        requestSeq,
        coverageFingerprint: evidence.coverageFingerprint,
        result: {
          kind: 'success',
          data: evidence.data,
          rowIds: evidence.rowIds,
        },
      };
    default:
      return { kind: 'loading', requestSeq };
  }
}

function buildHomeDeFiCoverage({
  requestSeq,
  rowCount,
  source,
}: {
  requestSeq: number;
  rowCount: number;
  source: 'allNetworks' | 'singleNetwork';
}): string {
  return `defi:${source}:${requestSeq}:rows:${rowCount}:complete`;
}

export { buildHomeDeFiCoverage, projectHomeDeFiSectionSource };
export type { IHomeDeFiEvidence };
