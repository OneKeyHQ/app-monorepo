import {
  COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS,
  COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS,
  collateralBadgeVariant,
  getCollateralSettlementRefreshDecision,
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

  it('a matching pending setCollateral tx disables the row', () => {
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
  const scope = {
    networkId: 'evm--1',
    marketAddress: '0xmarket',
    reserveAddress: '0xusde',
  };

  it('matches a reserve-scoped pending setCollateral tx', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [
          tx([
            'Borrow',
            'borrow:aave:setCollateral',
            'borrow:aave:setCollateral:v1:evm--1:0xmarket:0xusde',
          ]),
        ],
        provider: 'aave',
        ...scope,
      }),
    ).toBe(true);
  });

  it('does not match another reserve from the same provider', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [
          tx([
            'borrow:aave:setCollateral',
            'borrow:aave:setCollateral:v1:evm--1:0xmarket:0xusde',
          ]),
        ],
        provider: 'Aave',
        ...scope,
        reserveAddress: '0xusdt',
      }),
    ).toBe(false);
  });

  it('isolates a native reserve with an empty address from sibling rows', () => {
    const nativeTag = 'borrow:aave:setCollateral:v1:evm--1:0xmarket:';

    expect(
      hasPendingSetCollateral({
        pendingTxs: [tx(['borrow:aave:setCollateral', nativeTag])],
        provider: 'aave',
        ...scope,
        reserveAddress: '',
      }),
    ).toBe(true);
    expect(
      hasPendingSetCollateral({
        pendingTxs: [tx(['borrow:aave:setCollateral', nativeTag])],
        provider: 'aave',
        ...scope,
        reserveAddress: '0xusdt',
      }),
    ).toBe(false);
  });

  it('normalizes EVM market and reserve address casing', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [
          tx([
            'borrow:aave:setCollateral',
            'borrow:aave:setCollateral:v1:evm--1:0xmarket:0xusde',
          ]),
        ],
        provider: 'Aave',
        ...scope,
        marketAddress: '0xMaRkEt',
        reserveAddress: '0xUsDe',
      }),
    ).toBe(true);
  });

  it('keeps the provider-wide lock for a legacy pending tx', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [tx(['borrow:aave:setCollateral'])],
        provider: 'aave',
        ...scope,
        reserveAddress: '0xusdt',
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
        ...scope,
      }),
    ).toBe(false);
  });

  it('is false with no pending txs', () => {
    expect(
      hasPendingSetCollateral({
        pendingTxs: [],
        provider: 'aave',
        ...scope,
      }),
    ).toBe(false);
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

describe('getCollateralSettlementRefreshDecision', () => {
  it('stays idle without a local submission', () => {
    expect(
      getCollateralSettlementRefreshDecision({
        usageAsCollateral: false,
        targetUsageAsCollateral: null,
        completedRefreshAttempts: 0,
      }),
    ).toBe('idle');
  });

  it('settles as soon as refreshed reserves contain the target state', () => {
    expect(
      getCollateralSettlementRefreshDecision({
        usageAsCollateral: true,
        targetUsageAsCollateral: true,
        completedRefreshAttempts: 1,
      }),
    ).toBe('settled');
  });

  it('keeps retrying while refreshed reserves remain stale', () => {
    expect(
      getCollateralSettlementRefreshDecision({
        usageAsCollateral: false,
        targetUsageAsCollateral: true,
        completedRefreshAttempts:
          COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS - 1,
      }),
    ).toBe('retry');
  });

  it('switches to slow retries before the bounded reconciliation limit', () => {
    expect(
      getCollateralSettlementRefreshDecision({
        usageAsCollateral: false,
        targetUsageAsCollateral: true,
        completedRefreshAttempts: COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS,
      }),
    ).toBe('retry-slow');
    expect(
      getCollateralSettlementRefreshDecision({
        usageAsCollateral: false,
        targetUsageAsCollateral: true,
        completedRefreshAttempts:
          COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS - 1,
      }),
    ).toBe('retry-slow');
  });

  it('stops automatic refreshes after the bounded reconciliation limit', () => {
    expect(
      getCollateralSettlementRefreshDecision({
        usageAsCollateral: false,
        targetUsageAsCollateral: true,
        completedRefreshAttempts: COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS,
      }),
    ).toBe('exhausted');
  });
});
