import { EStakeProgressStep } from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';
import type { IBorrowAsset } from '@onekeyhq/shared/types/staking';

import {
  appendBorrowRepaySetupState,
  buildBorrowRepayPositionKey,
  buildBorrowTokenFromAsset,
  filterUnsupportedAaveNativeReserveAssets,
  getBorrowAssetByReserveAddress,
  getBorrowRepayMaxInputBalance,
  getBorrowRepayProgressStep,
  hasPositiveDebtBalance,
  isBorrowRepayAllAmount,
  isCollateralRepayEnabled,
  isUnsupportedAaveNativeReserve,
  resolveBorrowTokenApproveSpenderAddress,
  shouldUseAaveNativeGateway,
} from './borrowRepayPosition.utils';

describe('borrowRepayPosition utils', () => {
  it('treats zero debt as not eligible for collateral repay entry', () => {
    expect(hasPositiveDebtBalance('0')).toBe(false);
    expect(
      isCollateralRepayEnabled({
        providerName: 'kamino',
        debtBalance: '0',
        collateralLoading: false,
        collateralAssetCount: 2,
      }),
    ).toBe(false);
  });

  it('limits repay max input to the smaller wallet or debt balance', () => {
    expect(
      getBorrowRepayMaxInputBalance({
        walletBalance: '8',
        debtBalance: '10',
      }),
    ).toBe('8');
    expect(
      getBorrowRepayMaxInputBalance({
        walletBalance: '12',
        debtBalance: '10',
      }),
    ).toBe('10');
    expect(
      getBorrowRepayMaxInputBalance({
        walletBalance: 'bad-value',
        debtBalance: '10',
      }),
    ).toBe('0');
  });

  it('detects repay all from debt balance instead of wallet max balance', () => {
    expect(
      isBorrowRepayAllAmount({
        amount: '10',
        debtBalance: '10',
      }),
    ).toBe(true);
    expect(
      isBorrowRepayAllAmount({
        amount: '9.99',
        debtBalance: '10',
      }),
    ).toBe(false);
    expect(
      isBorrowRepayAllAmount({
        amount: '0',
        debtBalance: '10',
      }),
    ).toBe(false);
  });

  it('gates collateral repay to Kamino borrow markets', () => {
    expect(
      isCollateralRepayEnabled({
        providerName: 'kamino',
        debtBalance: '1',
        collateralLoading: false,
        collateralAssetCount: 1,
      }),
    ).toBe(true);
    expect(
      isCollateralRepayEnabled({
        providerName: 'aave',
        debtBalance: '1',
        collateralLoading: false,
        collateralAssetCount: 1,
      }),
    ).toBe(false);
  });

  it('uses the Aave native gateway only for the native reserve sentinel', () => {
    expect(
      shouldUseAaveNativeGateway({
        networkId: 'evm--1',
        providerName: 'aave',
        reserveAddress: '',
      }),
    ).toBe(true);
    expect(
      shouldUseAaveNativeGateway({
        networkId: 'evm--1',
        providerName: 'Aave',
        reserveAddress: '',
      }),
    ).toBe(true);
    expect(
      shouldUseAaveNativeGateway({
        networkId: 'evm--8453',
        providerName: 'aave',
        reserveAddress: '',
      }),
    ).toBe(false);
    expect(
      shouldUseAaveNativeGateway({
        networkId: 'evm--1',
        providerName: 'aave',
        reserveAddress: '0xWETH',
      }),
    ).toBe(false);
    expect(
      shouldUseAaveNativeGateway({
        networkId: 'evm--1',
        providerName: 'kamino',
        reserveAddress: '',
      }),
    ).toBe(false);
  });

  it('fails closed for unsupported Aave native reserves', () => {
    expect(
      isUnsupportedAaveNativeReserve({
        networkId: 'evm--8453',
        providerName: 'aave',
        reserveAddress: '',
      }),
    ).toBe(true);
    expect(
      isUnsupportedAaveNativeReserve({
        networkId: 'evm--1',
        providerName: 'aave',
        reserveAddress: '',
      }),
    ).toBe(false);
    expect(
      isUnsupportedAaveNativeReserve({
        networkId: 'evm--8453',
        providerName: 'aave',
        reserveAddress: '0xWETH',
      }),
    ).toBe(false);
  });

  it('filters unsupported Aave native reserve assets', () => {
    const assets = [
      {
        reserveAddress: '',
        token: { symbol: 'ETH' },
      },
      {
        reserveAddress: '0xWETH',
        token: { symbol: 'WETH' },
      },
    ] as unknown as IBorrowAsset[];

    expect(
      filterUnsupportedAaveNativeReserveAssets({
        assets,
        networkId: 'evm--8453',
        providerName: 'aave',
      }).map((asset) => asset.token.symbol),
    ).toEqual(['WETH']);
    expect(
      filterUnsupportedAaveNativeReserveAssets({
        assets,
        networkId: 'evm--1',
        providerName: 'aave',
      }).map((asset) => asset.token.symbol),
    ).toEqual(['ETH', 'WETH']);
  });

  it('falls back to the Aave market pool for ERC20 token approvals', () => {
    expect(
      resolveBorrowTokenApproveSpenderAddress({
        providerName: 'aave',
        marketAddress: '0xPool',
        tokenIsNative: false,
      }),
    ).toBe('0xPool');
    expect(
      resolveBorrowTokenApproveSpenderAddress({
        providerName: 'aave',
        marketAddress: '0xPool',
        backendApproveTarget: '0xBackend',
        tokenIsNative: false,
      }),
    ).toBe('0xBackend');
    expect(
      resolveBorrowTokenApproveSpenderAddress({
        providerName: 'aave',
        marketAddress: '0xPool',
        tokenIsNative: true,
      }),
    ).toBe('');
    expect(
      resolveBorrowTokenApproveSpenderAddress({
        providerName: 'kamino',
        marketAddress: '0xMarket',
        tokenIsNative: false,
      }),
    ).toBe('');
  });

  it('matches the native reserve empty-string sentinel', () => {
    const assets = [
      {
        reserveAddress: '',
        token: { symbol: 'ETH' },
      },
      {
        reserveAddress: '0xUSDC',
        token: { symbol: 'USDC' },
      },
    ] as unknown as IBorrowAsset[];

    expect(
      getBorrowAssetByReserveAddress({
        assets,
        reserveAddress: '',
      })?.token.symbol,
    ).toBe('ETH');
    expect(
      getBorrowAssetByReserveAddress({
        assets,
        reserveAddress: '0xusdc',
      })?.token.symbol,
    ).toBe('USDC');
    expect(
      getBorrowAssetByReserveAddress({
        assets,
        reserveAddress: undefined,
      }),
    ).toBeUndefined();
  });

  it('marks selected native reserve assets as native tokens', () => {
    const nativeAsset = {
      reserveAddress: '',
      token: {
        address: '0xWETH',
        decimals: 18,
        logoURI: 'eth.png',
        name: 'Ether',
        symbol: 'ETH',
      },
    } as IBorrowAsset;
    const erc20Asset = {
      reserveAddress: '0xUSDCReserve',
      token: {
        address: '0xUSDC',
        decimals: 6,
        logoURI: 'usdc.png',
        name: 'USD Coin',
        symbol: 'USDC',
      },
    } as IBorrowAsset;

    expect(
      buildBorrowTokenFromAsset({
        asset: nativeAsset,
        networkId: 'evm--1',
      }),
    ).toMatchObject({
      address: '',
      isNative: true,
      networkId: 'evm--1',
      symbol: 'ETH',
    });
    expect(
      buildBorrowTokenFromAsset({
        asset: erc20Asset,
        networkId: 'evm--1',
      }),
    ).toMatchObject({
      address: '0xUSDC',
      isNative: false,
      networkId: 'evm--1',
      symbol: 'USDC',
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
