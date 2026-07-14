import {
  collateralBadgeVariant,
  getCollateralSwitchState,
  hasPendingSetCollateral,
  isBorrowAssetVisible,
  shouldReleaseCollateralSubmission,
} from './collateralControls.utils';

describe('isBorrowAssetVisible', () => {
  it('shows when canBeBorrowed is true', () => {
    expect(isBorrowAssetVisible({ canBeBorrowed: true })).toBe(true);
  });

  it('hides when canBeBorrowed is false', () => {
    expect(isBorrowAssetVisible({ canBeBorrowed: false })).toBe(false);
  });

  it('shows when canBeBorrowed is undefined (missing data must not hide assets)', () => {
    expect(isBorrowAssetVisible({})).toBe(true);
  });
});

describe('collateralBadgeVariant', () => {
  it('maps true to the green check variant', () => {
    expect(collateralBadgeVariant(true)).toBe('can');
  });

  it('maps false to the dash variant', () => {
    expect(collateralBadgeVariant(false)).toBe('cannot');
  });

  it('maps undefined to nothing', () => {
    expect(collateralBadgeVariant(undefined)).toBeNull();
  });
});

describe('getCollateralSwitchState', () => {
  const base = { submitting: false, pendingSetCollateral: false };

  it('does not render without a current-state value (provider unsupported)', () => {
    expect(
      getCollateralSwitchState({ ...base, canBeCollateral: true }).render,
    ).toBe(false);
  });

  it('renders ON and enabled for an active collateral position', () => {
    expect(
      getCollateralSwitchState({
        ...base,
        usageAsCollateral: true,
        canBeCollateral: true,
      }),
    ).toEqual({ render: true, value: true, disabled: false });
  });

  it('an active position can always be turned OFF, even if no longer eligible', () => {
    expect(
      getCollateralSwitchState({
        ...base,
        usageAsCollateral: true,
        canBeCollateral: false,
      }),
    ).toEqual({ render: true, value: true, disabled: false });
  });

  it('an inactive position can be turned ON only if currently eligible', () => {
    expect(
      getCollateralSwitchState({
        ...base,
        usageAsCollateral: false,
        canBeCollateral: true,
      }).disabled,
    ).toBe(false);
  });

  it('an inactive, ineligible position is OFF and locked', () => {
    expect(
      getCollateralSwitchState({
        ...base,
        usageAsCollateral: false,
        canBeCollateral: false,
      }),
    ).toEqual({ render: true, value: false, disabled: true });
  });

  it('missing eligibility data locks an inactive position (no optimistic enable)', () => {
    expect(
      getCollateralSwitchState({ ...base, usageAsCollateral: false }).disabled,
    ).toBe(true);
  });

  it('submitting disables the row', () => {
    expect(
      getCollateralSwitchState({
        usageAsCollateral: true,
        canBeCollateral: true,
        submitting: true,
        pendingSetCollateral: false,
      }).disabled,
    ).toBe(true);
  });

  it('a provider-level pending setCollateral tx disables the row', () => {
    expect(
      getCollateralSwitchState({
        usageAsCollateral: true,
        canBeCollateral: true,
        submitting: false,
        pendingSetCollateral: true,
      }).disabled,
    ).toBe(true);
  });
});

describe('hasPendingSetCollateral', () => {
  const tx = (tags?: string[]) => ({ stakingInfo: { tags } });

  it('matches a pending setCollateral tx for the provider', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [tx(['Borrow', 'borrow:aave:setCollateral'])],
        provider: 'aave',
      }),
    ).toBe(true);
  });

  it('matches case-insensitively on provider (tag builder lowercases)', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [tx(['borrow:aave:setCollateral'])],
        provider: 'Aave',
      }),
    ).toBe(true);
  });

  it('ignores other actions and other providers', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [
          tx(['borrow:aave:repay']),
          tx(['borrow:kamino:setCollateral']),
          tx(undefined),
        ],
        provider: 'aave',
      }),
    ).toBe(false);
  });

  it('is false with no pending txs', () => {
    expect(hasPendingSetCollateral({ pendingTxs: [], provider: 'aave' })).toBe(
      false,
    );
  });
});

describe('shouldReleaseCollateralSubmission', () => {
  it('keeps the local lock across stale reserve refreshes', () => {
    expect(
      shouldReleaseCollateralSubmission({
        usageAsCollateral: false,
        targetUsageAsCollateral: true,
      }),
    ).toBe(false);
  });

  it('releases only once the target state lands', () => {
    expect(
      shouldReleaseCollateralSubmission({
        usageAsCollateral: true,
        targetUsageAsCollateral: true,
      }),
    ).toBe(true);
    expect(
      shouldReleaseCollateralSubmission({
        usageAsCollateral: false,
        targetUsageAsCollateral: true,
      }),
    ).toBe(false);
  });
});
