export type IHomeShadowMismatchReasonCode =
  | 'ownerMismatch'
  | 'shellKindMismatch'
  | 'portfolioKindMismatch'
  | 'balanceAuthorityMismatch'
  | 'actionSetMismatch'
  | 'bannerMismatch'
  | 'navigationKindMismatch'
  | 'tabSetOrOrderMismatch'
  | 'selectedTabMismatch'
  | 'sectionKindMismatch'
  | 'sectionRowsMismatch'
  | 'sectionFreshnessMismatch';

export type IHomeShadowNotComparableReasonCode =
  | 'blockedFixture'
  | 'currentObservationUnavailable'
  | 'normalizedFactUnavailable'
  | 'runtimeNotReady';

export type IHomePhase0Classification =
  | 'intentional'
  | 'historicalDrift'
  | 'defect'
  | 'openDecision';

export type IHomeShadowComparisonStatus =
  | 'equal'
  | 'classifiedDifference'
  | 'unclassifiedDifference'
  | 'notComparable';
