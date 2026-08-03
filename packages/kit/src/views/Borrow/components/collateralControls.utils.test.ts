import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import {
  COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS,
  COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS,
  collateralBadgeVariant,
  getActiveEModeCollateralEligibility,
  getCollateralSettlementRefreshDecision,
  getCollateralSwitchState,
  hasPendingSetCollateral,
  isBorrowAssetVisible,
  shouldReleaseCollateralSubmission,
} from './collateralControls.utils';

const eModeStatus: IBorrowEModeStatus = {
  eModeId: 1,
  originalLtv: '78.63',
  categories: [
    {
      eModeId: 1,
      label: 'Stablecoins',
      ltv: '90',
      disabled: false,
      assets: [
        {
          reserveAddress: '0xAbC',
          token: {
            decimals: 6,
            name: 'USD Coin',
            symbol: 'USDC',
            address: '0xAbC',
            isNative: false,
            networkId: 'evm--1',
          },
          boostedLTV: true,
          borrowable: true,
        },
        {
          reserveAddress: '0xDeF',
          token: {
            decimals: 18,
            name: 'Dai Stablecoin',
            symbol: 'DAI',
            address: '0xDeF',
            isNative: false,
            networkId: 'evm--1',
          },
          boostedLTV: false,
          borrowable: true,
        },
      ],
    },
  ],
};

describe('getActiveEModeCollateralEligibility', () => {
  it('allows reserve-level collateral flags while eMode is off', () => {
    expect(
      getActiveEModeCollateralEligibility({
        eModeStatus: { ...eModeStatus, eModeId: 0 },
        networkId: 'evm--1',
        reserveAddress: '0xMissing',
      }),
    ).toBe(true);
  });

  it('matches an included reserve using network-aware normalization', () => {
    expect(
      getActiveEModeCollateralEligibility({
        eModeStatus,
        networkId: 'evm--1',
        reserveAddress: '0xaBc',
      }),
    ).toBe(true);
  });

  it.each([
    ['the category collateral flag is false', '0xdef'],
    ['the reserve is absent from the category', '0xMissing'],
  ])('rejects collateral when %s', (_title, reserveAddress) => {
    expect(
      getActiveEModeCollateralEligibility({
        eModeStatus,
        networkId: 'evm--1',
        reserveAddress,
      }),
    ).toBe(false);
  });

  it('returns unknown when the active category is missing', () => {
    expect(
      getActiveEModeCollateralEligibility({
        eModeStatus: { ...eModeStatus, eModeId: 2 },
        networkId: 'evm--1',
        reserveAddress: '0xabc',
      }),
    ).toBeUndefined();
  });
});

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
