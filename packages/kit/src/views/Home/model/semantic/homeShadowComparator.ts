import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import type { IHomeRuntimeSourceId } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type { IHomeSectionId, IHomeSemanticModel } from './homeSemanticTypes';
import type {
  IHomePhase0Classification,
  IHomeShadowComparisonStatus,
  IHomeShadowMismatchReasonCode,
  IHomeShadowNotComparableReasonCode,
} from './homeShadowReasonCodes';

export type IHomeShadowComparison = {
  status: IHomeShadowComparisonStatus;
  vectorId?: string;
  classification?: IHomePhase0Classification;
  mismatchReasons: readonly IHomeShadowMismatchReasonCode[];
  notComparableReason?: IHomeShadowNotComparableReasonCode;
};

export type IHomeShadowTrace = {
  ownerHash: string;
  sessionHash: string;
  vectorId?: string;
  sourceId?: IHomeRuntimeSourceId;
  status: IHomeShadowComparisonStatus;
  reasons: readonly (
    | IHomeShadowMismatchReasonCode
    | IHomeShadowNotComparableReasonCode
  )[];
  durationMs: number;
};

const sectionIds: readonly IHomeSectionId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
];

function equal(first: unknown, second: unknown): boolean {
  return (
    stringUtils.stableStringify(first) === stringUtils.stableStringify(second)
  );
}

function addReason(
  reasons: IHomeShadowMismatchReasonCode[],
  reason: IHomeShadowMismatchReasonCode,
) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

export function compareHomeSemanticShadow({
  classification,
  current,
  notComparableReason,
  shadow,
  vectorId,
}: {
  classification?: IHomePhase0Classification;
  current?: IHomeSemanticModel;
  notComparableReason?: IHomeShadowNotComparableReasonCode;
  shadow: IHomeSemanticModel;
  vectorId?: string;
}): IHomeShadowComparison {
  if (!current || notComparableReason) {
    return {
      status: 'notComparable',
      vectorId,
      classification,
      mismatchReasons: [],
      notComparableReason:
        notComparableReason ?? 'currentObservationUnavailable',
    };
  }
  const reasons: IHomeShadowMismatchReasonCode[] = [];
  if (!equal(shadow.owner, current.owner)) addReason(reasons, 'ownerMismatch');
  if (shadow.shell.kind !== current.shell.kind) {
    addReason(reasons, 'shellKindMismatch');
  } else if (
    shadow.shell.kind === 'portfolio' &&
    current.shell.kind === 'portfolio'
  ) {
    const first = shadow.shell.presentation;
    const second = current.shell.presentation;
    if (first.kind !== second.kind) addReason(reasons, 'portfolioKindMismatch');
    if (
      first.kind === 'funded' &&
      second.kind === 'funded' &&
      first.header.authority !== second.header.authority
    ) {
      addReason(reasons, 'balanceAuthorityMismatch');
    }
    if (!equal(first.actions.items, second.actions.items)) {
      addReason(reasons, 'actionSetMismatch');
    }
    if (!equal(first.banner, second.banner))
      addReason(reasons, 'bannerMismatch');
  }
  if (shadow.navigation.kind !== current.navigation.kind) {
    addReason(reasons, 'navigationKindMismatch');
  } else if (
    shadow.navigation.kind === 'ready' &&
    current.navigation.kind === 'ready'
  ) {
    if (!equal(shadow.navigation.tabs, current.navigation.tabs)) {
      addReason(reasons, 'tabSetOrOrderMismatch');
    }
    if (shadow.navigation.selectedTabId !== current.navigation.selectedTabId) {
      addReason(reasons, 'selectedTabMismatch');
    }
  }
  sectionIds.forEach((id) => {
    const first = shadow.sections[id];
    const second = current.sections[id];
    if (first.kind !== second.kind) {
      addReason(reasons, 'sectionKindMismatch');
      return;
    }
    if (first.kind === 'ready' && second.kind === 'ready') {
      if (!equal(first.rowIds, second.rowIds)) {
        addReason(reasons, 'sectionRowsMismatch');
      }
      if (first.freshness !== second.freshness) {
        addReason(reasons, 'sectionFreshnessMismatch');
      }
    }
  });
  if (reasons.length === 0) {
    return { status: 'equal', vectorId, mismatchReasons: [] };
  }
  return {
    status: classification ? 'classifiedDifference' : 'unclassifiedDifference',
    vectorId,
    classification,
    mismatchReasons: reasons,
  };
}

function hashSensitiveIdentity(value: string): string {
  return bytesToHex(
    sha256(utf8ToBytes(`home-shadow-identity-v1:${value}`)),
  ).slice(0, 16);
}

export function createHomeShadowTrace({
  comparison,
  durationMs,
  ownerScopeKey,
  sessionId,
  sourceId,
}: {
  comparison: IHomeShadowComparison;
  durationMs: number;
  ownerScopeKey: string;
  sessionId: string;
  sourceId?: IHomeRuntimeSourceId;
}): IHomeShadowTrace {
  return {
    ownerHash: hashSensitiveIdentity(ownerScopeKey),
    sessionHash: hashSensitiveIdentity(sessionId),
    vectorId: comparison.vectorId,
    sourceId,
    status: comparison.status,
    reasons: comparison.notComparableReason
      ? [comparison.notComparableReason]
      : comparison.mismatchReasons,
    durationMs,
  };
}
