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
  | {
      kind: 'partial';
      coverageFingerprint: string;
      data: IHomeDeFiLegacyPayload;
    }
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
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeDeFiEvidence;
  scopeMatches: boolean;
}): IHomeDeFiSourceSnapshot {
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
      if (!evidence.data || evidence.rowIds.length === 0) {
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

function buildHomeDeFiCoverage({
  rowCount,
  source,
}: {
  rowCount: number;
  source: 'allNetworks' | 'singleNetwork';
}): string {
  return `defi:${source}:rows:${rowCount}:complete`;
}

export { buildHomeDeFiCoverage, projectHomeDeFiSectionSource };
export type { IHomeDeFiEvidence };
