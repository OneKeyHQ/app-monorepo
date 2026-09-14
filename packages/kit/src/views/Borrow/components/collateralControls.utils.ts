import {
  buildBorrowTag,
  parseBorrowTag,
} from '@onekeyhq/kit/src/views/Staking/utils/utils';

// Pure predicates for the Borrow collateral/borrowable controls.
// Client composes server-owned flags without duplicating health-factor math.
// Note (Aave v3.2+ liquid e-modes): enabling collateral is NOT restricted by
// the active e-mode category — collateral outside the category simply keeps
// its own LTV/LT instead of the boosted one. Eligibility therefore comes from
// the server's per-reserve canBeCollateral flag plus the live
// transaction-confirmation preview; the client adds no category-based gating.

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

export function hasPendingSetCollateral({
  pendingTxs,
  provider,
  networkId,
  marketAddress,
  reserveAddress,
}: {
  pendingTxs: { stakingInfo: { tags?: string[] } }[];
  provider: string;
  networkId: string;
  marketAddress: string;
  reserveAddress: string;
}): boolean {
  const providerTag = buildBorrowTag({ provider, action: 'setCollateral' });
  const reserveTag = buildBorrowTag({
    provider,
    action: 'setCollateral',
    setCollateralScope: { networkId, marketAddress, reserveAddress },
  });

  return pendingTxs.some((tx) => {
    const tags = tx.stakingInfo.tags ?? [];
    const hasReserveScopedTag = tags.some((tag) => {
      const parsed = parseBorrowTag(tag);
      return (
        parsed?.provider === provider.toLowerCase() &&
        parsed.action === 'setCollateral' &&
        parsed.setCollateralScope !== undefined
      );
    });

    // Older pending entries do not identify the reserve. Keep their original
    // provider-wide lock until they settle; newly created entries use the
    // exact reserve tag and no longer affect sibling switches.
    return hasReserveScopedTag
      ? tags.includes(reserveTag)
      : tags.includes(providerTag);
  });
}
