import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';

// Pure predicates for the Borrow collateral/borrowable controls.
// Client trusts backend flags — no local HF math, no provider branches.

// Assets to Borrow visibility: undefined ⇒ show (missing data must not hide assets).
export function isBorrowAssetVisible(asset: {
  canBeBorrowed?: boolean;
}): boolean {
  return asset.canBeBorrowed !== false;
}

export type ICollateralBadgeVariant = 'can' | 'cannot' | null;

// "Can be collateral" indicator: green check / gray dash / nothing.
export function collateralBadgeVariant(
  canBeCollateral?: boolean,
): ICollateralBadgeVariant {
  if (canBeCollateral === true) return 'can';
  if (canBeCollateral === false) return 'cannot';
  return null;
}

// Aave semantics: an active position can always be turned OFF; an inactive
// one can be turned ON only while the backend reports it eligible.
export function getCollateralSwitchState({
  usageAsCollateral,
  canBeCollateral,
  submitting,
  pendingSetCollateral,
}: {
  usageAsCollateral?: boolean;
  canBeCollateral?: boolean;
  submitting: boolean;
  pendingSetCollateral: boolean;
}): { render: boolean; value: boolean; disabled: boolean } {
  return {
    render: usageAsCollateral !== undefined,
    value: usageAsCollateral === true,
    disabled:
      submitting ||
      pendingSetCollateral ||
      (usageAsCollateral === false && canBeCollateral !== true),
  };
}

export function shouldReleaseCollateralSubmission({
  usageAsCollateral,
  targetUsageAsCollateral,
}: {
  usageAsCollateral?: boolean;
  targetUsageAsCollateral: boolean | null;
}): boolean {
  return (
    targetUsageAsCollateral !== null &&
    usageAsCollateral === targetUsageAsCollateral
  );
}

export const COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS = 5;
export const COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS = 8;

export type ICollateralSettlementRefreshDecision =
  | 'idle'
  | 'settled'
  | 'retry'
  | 'retry-slow'
  | 'exhausted';

export function getCollateralSettlementRefreshDecision({
  usageAsCollateral,
  targetUsageAsCollateral,
  completedRefreshAttempts,
  fastRefreshAttempts = COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS,
  maxRefreshAttempts = COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS,
}: {
  usageAsCollateral?: boolean;
  targetUsageAsCollateral: boolean | null;
  completedRefreshAttempts: number;
  fastRefreshAttempts?: number;
  maxRefreshAttempts?: number;
}): ICollateralSettlementRefreshDecision {
  if (targetUsageAsCollateral === null) {
    return 'idle';
  }
  if (usageAsCollateral === targetUsageAsCollateral) {
    return 'settled';
  }
  if (completedRefreshAttempts >= maxRefreshAttempts) {
    return 'exhausted';
  }
  if (completedRefreshAttempts >= fastRefreshAttempts) {
    return 'retry-slow';
  }
  return 'retry';
}

// buildBorrowTag carries provider+action only (no reserve identity), so this
// check is provider-scoped by construction: any pending setCollateral tx
// disables ALL of that provider's switches until data refreshes.
export function hasPendingSetCollateral({
  pendingTxs,
  provider,
}: {
  pendingTxs: { stakingInfo: { tags?: string[] } }[];
  provider: string;
}): boolean {
  const tag = buildBorrowTag({ provider, action: 'setCollateral' });
  return pendingTxs.some((tx) => tx.stakingInfo.tags?.includes(tag));
}
