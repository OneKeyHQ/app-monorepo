import type {
  IHomeNFTLegacyPayload,
  IHomeNFTSourceSnapshot,
} from './homeNFTSourceAdapter';

type IHomeNFTEvidence =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: IHomeNFTLegacyPayload;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | { kind: 'partial'; coverageFingerprint: string }
  | {
      kind: 'complete';
      confirmedEmpty: boolean;
      coverageFingerprint: string;
      data: IHomeNFTLegacyPayload | undefined;
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

function projectHomeNFTSectionSource({
  authorityReady,
  evidence,
  requestSeq,
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeNFTEvidence;
  requestSeq: number;
  scopeMatches: boolean;
}): IHomeNFTSourceSnapshot {
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

function buildHomeNFTCoverage({
  requestSeq,
  rowCount,
  source,
}: {
  requestSeq: number;
  rowCount: number;
  source: 'allNetworks' | 'singleNetwork';
}): string {
  return `nft:${source}:${requestSeq}:rows:${rowCount}:complete`;
}

export { buildHomeNFTCoverage, projectHomeNFTSectionSource };
export type { IHomeNFTEvidence };
