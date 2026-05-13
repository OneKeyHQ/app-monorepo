import { EStakeProgressStep } from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';

import {
  appendBorrowRepaySetupState,
  buildBorrowRepayPositionKey,
  getBorrowAssetByReserveAddress,
  getBorrowRepayMaxInputBalance,
  getBorrowRepayProgressStep,
  getBorrowRepayWalletBalance,
  hasPositiveDebtBalance,
  isBorrowRepayAllAmount,
  isCollateralRepayEnabled,
} from './borrowRepayPosition.utils';

describe('borrowRepayPosition utils', () => {
  it('treats zero debt as not eligible for collateral repay entry', () => {
    expect(hasPositiveDebtBalance('0')).toBe(false);
    expect(
      isCollateralRepayEnabled({
        providerName: EBorrowProviderEnum.Kamino,
        debtBalance: '0',
        collateralLoading: false,
        collateralAssetCount: 2,
      }),
    ).toBe(false);
  });

  it('only enables collateral repay for providers that support the endpoint', () => {
    expect(
      isCollateralRepayEnabled({
        providerName: EBorrowProviderEnum.Kamino,
        debtBalance: '1',
        collateralLoading: false,
        collateralAssetCount: 2,
      }),
    ).toBe(true);

    expect(
      isCollateralRepayEnabled({
        providerName: EBorrowProviderEnum.Aave,
        debtBalance: '1',
        collateralLoading: false,
        collateralAssetCount: 2,
      }),
    ).toBe(false);
  });

  it('keeps repay max input separate from repayAll debt semantics', () => {
    expect(
      getBorrowRepayMaxInputBalance({
        walletBalance: '5',
        debtBalance: '10',
      }),
    ).toBe('5');
    expect(isBorrowRepayAllAmount({ amount: '5', debtBalance: '10' })).toBe(
      false,
    );

    expect(
      getBorrowRepayMaxInputBalance({
        walletBalance: '12',
        debtBalance: '10',
      }),
    ).toBe('10');
    expect(isBorrowRepayAllAmount({ amount: '10', debtBalance: '10' })).toBe(
      true,
    );
    expect(isBorrowRepayAllAmount({ amount: '5' })).toBe(false);
  });

  it('matches the current reserve asset before user selection', () => {
    const assets = [
      {
        reserveAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        token: {
          address: '0xtoken',
          name: 'Token',
          symbol: 'TKN',
          decimals: 6,
          logoURI: '',
        },
        balance: {
          title: { text: '10' },
          description: { text: '$10' },
        },
        walletBalance: {
          amount: '3',
          fiatValue: '3',
          title: { text: '3' },
          description: { text: '$3' },
        },
        borrowed: {
          amount: '10',
          fiatValue: '10',
          title: { text: '10' },
          description: { text: '$10' },
        },
        supplied: {
          title: { text: '0' },
          description: { text: '$0' },
        },
        apyDetail: {
          apy: '0',
          normal: { text: '0' },
        },
      },
    ];

    expect(
      getBorrowAssetByReserveAddress({
        assets,
        reserveAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      }),
    ).toBe(assets[0]);

    expect(
      getBorrowAssetByReserveAddress({
        assets,
        reserveAddress: 'SoLaNaReserve',
      }),
    ).toBeUndefined();
  });

  it('uses selected repay asset wallet balance when present', () => {
    expect(
      getBorrowRepayWalletBalance({
        selectedAsset: {
          reserveAddress: 'reserve',
          token: {
            address: '0xtoken',
            name: 'Token',
            symbol: 'TKN',
            decimals: 6,
            logoURI: '',
          },
          balance: {
            title: { text: '10' },
            description: { text: '$10' },
          },
          walletBalance: {
            amount: '3',
            fiatValue: '3',
            title: { text: '3' },
            description: { text: '$3' },
          },
          borrowed: {
            amount: '10',
            fiatValue: '10',
            title: { text: '10' },
            description: { text: '$10' },
          },
          supplied: {
            title: { text: '0' },
            description: { text: '$0' },
          },
          apyDetail: {
            apy: '0',
            normal: { text: '0' },
          },
        },
        fallbackWalletBalance: '100',
      }),
    ).toEqual({
      balance: '3',
      missingWalletBalance: false,
    });
  });

  it('fails closed when selected repay asset has no wallet balance', () => {
    expect(
      getBorrowRepayWalletBalance({
        selectedAsset: {
          reserveAddress: 'reserve',
          token: {
            address: '0xtoken',
            name: 'Token',
            symbol: 'TKN',
            decimals: 6,
            logoURI: '',
          },
          balance: {
            title: { text: '10' },
            description: { text: '$10' },
          },
          borrowed: {
            amount: '10',
            fiatValue: '10',
            title: { text: '10' },
            description: { text: '$10' },
          },
          supplied: {
            title: { text: '0' },
            description: { text: '$0' },
          },
          apyDetail: {
            apy: '0',
            normal: { text: '0' },
          },
        },
        fallbackWalletBalance: '100',
      }),
    ).toEqual({
      balance: '0',
      missingWalletBalance: true,
    });
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
});
