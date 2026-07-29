import type {
  IHomePerpsLegacyPayload,
  IHomePerpsSourceSnapshot,
} from './homePerpsSourceAdapter';

type IHomePerpsEvidence =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: IHomePerpsLegacyPayload;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | { kind: 'partial'; coverageFingerprint: string }
  | {
      kind: 'complete';
      confirmedEmpty: boolean;
      coverageFingerprint: string;
      data: IHomePerpsLegacyPayload | undefined;
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

function projectHomePerpsSectionSource({
  authorityReady,
  evidence,
  scopeMatches,
}: {
  authorityReady: boolean;
  evidence: IHomePerpsEvidence;
  scopeMatches: boolean;
}): IHomePerpsSourceSnapshot {
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

function buildHomePerpsCoverage(): string {
  return 'perps:complete';
}

export { buildHomePerpsCoverage, projectHomePerpsSectionSource };
export type { IHomePerpsEvidence };
