import type {
  IHomeMarketLegacyPayload,
  IHomeMarketSourceSnapshot,
  IHomeMarketTokenRow,
} from './homeMarketSourceAdapter';

type IHomeMarketEvidence<TToken extends IHomeMarketTokenRow> =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: IHomeMarketLegacyPayload<TToken>;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | { kind: 'partial'; coverageFingerprint: string }
  | {
      kind: 'complete';
      confirmedEmpty: boolean;
      coverageFingerprint: string;
      data: IHomeMarketLegacyPayload<TToken> | undefined;
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

function projectHomeMarketSectionSource<TToken extends IHomeMarketTokenRow>({
  authorityReady,
  evidence,
  requestSeq,
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomeMarketEvidence<TToken>;
  requestSeq: number;
  scopeMatches: boolean;
}): IHomeMarketSourceSnapshot<TToken> {
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

function buildHomeMarketCoverage({
  favoriteMode,
  requestSeq,
  resolvedCategoryId,
  rowCount,
  selectedCategoryId,
}: {
  favoriteMode: 'favorites' | 'recommendation';
  requestSeq: number;
  resolvedCategoryId: string;
  rowCount: number;
  selectedCategoryId: string;
}): string {
  return `market:${selectedCategoryId}:${resolvedCategoryId}:${favoriteMode}:${requestSeq}:rows:${rowCount}:complete`;
}

function buildHomeMarketPartialCoverage({
  prefetchCount,
  requestSeq,
  resolvedCategoryId,
  settledCount,
}: {
  prefetchCount: number;
  requestSeq: number;
  resolvedCategoryId: string;
  settledCount: number;
}): string {
  return `market:${resolvedCategoryId}:${requestSeq}:partial:${settledCount}/${prefetchCount}`;
}

export {
  buildHomeMarketCoverage,
  buildHomeMarketPartialCoverage,
  projectHomeMarketSectionSource,
};
export type { IHomeMarketEvidence };
