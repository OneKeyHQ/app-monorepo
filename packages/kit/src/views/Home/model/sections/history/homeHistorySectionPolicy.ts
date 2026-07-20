import type {
  IHomeHistoryLegacyPayload,
  IHomeHistorySourceSnapshot,
} from './homeHistorySourceAdapter';

type IHomeHistoryEvidence =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: IHomeHistoryLegacyPayload;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | { kind: 'partial'; coverageFingerprint: string }
  | {
      kind: 'complete';
      confirmedEmpty: boolean;
      coverageFingerprint: string;
      data: IHomeHistoryLegacyPayload | undefined;
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

function projectHomeHistorySectionSource({
  authorityReady,
  evidence,
  requestSeq,
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeHistoryEvidence;
  requestSeq: number;
  scopeMatches: boolean;
}): IHomeHistorySourceSnapshot {
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

function buildHomeHistoryCoverage({
  requestSeq,
  rowCount,
  source,
}: {
  requestSeq: number;
  rowCount: number;
  source: 'allNetworks' | 'singleNetwork';
}): string {
  return `history:${source}:${requestSeq}:rows:${rowCount}:complete`;
}

export { buildHomeHistoryCoverage, projectHomeHistorySectionSource };
export type { IHomeHistoryEvidence };
