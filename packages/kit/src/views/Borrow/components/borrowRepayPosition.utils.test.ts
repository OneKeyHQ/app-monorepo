import { EStakeProgressStep } from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';

import {
  appendBorrowRepaySetupState,
  buildBorrowRepayPositionKey,
  buildBorrowRepayWithCollateralConfirmationParams,
  getBorrowBalanceAmount,
  getBorrowRepayProgressStep,
  getEffectiveBorrowRepayNeedsSetupLut,
  hasPositiveBorrowBalance,
  hasPositiveDebtBalance,
  isCollateralRepayEnabled,
} from './borrowRepayPosition.utils';

describe('borrowRepayPosition utils', () => {
  it('uses the raw borrow balance before rounded display values', () => {
    const balance = {
      number: '0.0000001',
      amount: '0',
      title: { text: '0' },
    };

    expect(getBorrowBalanceAmount(balance)).toBe('0.0000001');
    expect(hasPositiveBorrowBalance(balance)).toBe(true);
  });

  it('treats zero debt as not eligible for collateral repay entry', () => {
    expect(hasPositiveDebtBalance('0')).toBe(false);
    expect(
      isCollateralRepayEnabled({
        debtBalance: '0',
        collateralLoading: false,
        collateralAssetCount: 2,
      }),
    ).toBe(false);
  });

  it('invalidates request keys when setup state changes', () => {
    const baseKey = buildBorrowRepayPositionKey({
      amount: '1',
      collateralReserveAddress: 'collateral-reserve',
      repayAll: false,
      slippageBps: 50,
      hasDebtPosition: true,
    });

    expect(baseKey).toBe('1:collateral-reserve:0:50');
    expect(
      appendBorrowRepaySetupState({
        requestKey: baseKey,
        needsSetupLut: true,
      }),
    ).toBe('1:collateral-reserve:0:50:setup');
    expect(
      appendBorrowRepaySetupState({
        requestKey: baseKey,
        needsSetupLut: false,
      }),
    ).toBe('1:collateral-reserve:0:50:ready');
  });

  it.each([true, false])(
    'forwards repayAll=%s to collateral-repay confirmation',
    (repayAll) => {
      expect(
        buildBorrowRepayWithCollateralConfirmationParams({
          accountId: 'account-1',
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xmarket',
          reserveAddress: '0xdebt',
          amount: '1',
          collateralReserveAddress: '0xcollateral',
          repayAll,
          slippageBps: 50,
        }),
      ).toEqual(
        expect.objectContaining({
          action: 'repayWithCollateral',
          repayAll,
        }),
      );
    },
  );

  it('advances progress from setup to repay for the same input key', () => {
    const progressKey = buildBorrowRepayPositionKey({
      amount: '1',
      collateralReserveAddress: 'collateral-reserve',
      repayAll: false,
      slippageBps: 50,
      hasDebtPosition: true,
    });

    expect(
      getBorrowRepayProgressStep({
        progressKey,
        needsSetupLut: true,
      }),
    ).toBe(EStakeProgressStep.approve);

    expect(
      getBorrowRepayProgressStep({
        progressKey,
        needsSetupLut: true,
        setupReadyProgressKey: progressKey,
      }),
    ).toBe(EStakeProgressStep.deposit);

    expect(
      getBorrowRepayProgressStep({
        progressKey,
        needsSetupLut: false,
        setupReadyProgressKey: 'different-key',
      }),
    ).toBeUndefined();
  });

  it('treats setup as complete only for the same repay input key', () => {
    const progressKey = buildBorrowRepayPositionKey({
      amount: '1',
      collateralReserveAddress: 'collateral-reserve',
      repayAll: false,
      slippageBps: 50,
      hasDebtPosition: true,
    });

    expect(
      getEffectiveBorrowRepayNeedsSetupLut({
        progressKey,
        needsSetupLut: true,
        setupReadyProgressKey: progressKey,
      }),
    ).toBe(false);
    expect(
      getEffectiveBorrowRepayNeedsSetupLut({
        progressKey,
        needsSetupLut: true,
        setupReadyProgressKey: 'different-key',
      }),
    ).toBe(true);
  });
});
