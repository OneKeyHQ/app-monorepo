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
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeNFTEvidence;
  scopeMatches: boolean;
}): IHomeNFTSourceSnapshot {
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

function buildHomeNFTCoverage({
  rowCount,
  source,
}: {
  rowCount: number;
  source: 'allNetworks' | 'singleNetwork';
}): string {
  return `nft:${source}:rows:${rowCount}:complete`;
}

export { buildHomeNFTCoverage, projectHomeNFTSectionSource };
export type { IHomeNFTEvidence };
