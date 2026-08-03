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
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeSpotEvidence<T>;
  scopeMatches: boolean;
}): IHomeSpotSourceSnapshot<T> {
  if (!authorityReady || !scopeMatches) {
    return { kind: 'loading' };
  }
  switch (evidence.kind) {
    case 'loading':
      return { kind: 'loading' };
    case 'confirmedCache':
      return evidence;
    case 'partial':
      return evidence;
    case 'error':
      return evidence;
    case 'complete':
      if (evidence.confirmedEmpty) {
        return {
          kind: 'complete',
          coverageFingerprint: evidence.coverageFingerprint,
          result: { kind: 'empty' },
        };
      }
      if (evidence.rowIds.length === 0) {
        return { kind: 'loading' };
      }
      return {
        kind: 'complete',
        coverageFingerprint: evidence.coverageFingerprint,
        result: {
          kind: 'success',
          data: evidence.data,
          rowIds: evidence.rowIds,
        },
      };
    default:
      return { kind: 'loading' };
  }
}

function buildHomeSpotSingleCoverage(): string {
  return 'single:complete';
}

function buildHomeSpotAllCoverage({
  expected,
  failed,
  settled,
}: {
  expected: number;
  failed: number;
  settled: number;
}): string {
  return `all:${settled}/${expected}:${failed}`;
}

export {
  buildHomeSpotAllCoverage,
  buildHomeSpotSingleCoverage,
  projectHomeSpotSectionSource,
};
export type { IHomeSpotEvidence };
