import type { IHomeSpotSourceSnapshot } from './homeSpotSourceAdapter';

type IHomeSpotEvidence<T> =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: T;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | { kind: 'partial'; coverageFingerprint: string }
  | {
      kind: 'complete';
      confirmedEmpty: boolean;
      coverageFingerprint: string;
      data: T;
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

function projectHomeSpotSectionSource<T>({
  authorityReady,
  evidence,
  requestSeq,
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeSpotEvidence<T>;
  requestSeq: number;
  scopeMatches: boolean;
}): IHomeSpotSourceSnapshot<T> {
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
      if (evidence.rowIds.length === 0) {
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

function buildHomeSpotSingleCoverage(requestSeq: number): string {
  return `single:${requestSeq}:complete`;
}

function buildHomeSpotAllCoverage({
  expected,
  failed,
  requestSeq,
  settled,
}: {
  expected: number;
  failed: number;
  requestSeq: number;
  settled: number;
}): string {
  return `all:${requestSeq}:${settled}/${expected}:${failed}`;
}

export {
  buildHomeSpotAllCoverage,
  buildHomeSpotSingleCoverage,
  projectHomeSpotSectionSource,
};
export type { IHomeSpotEvidence };
