/* eslint-disable import/first */

jest.mock('react-intl', () => {
  const actualReactIntl =
    jest.requireActual<typeof import('react-intl')>('react-intl');

  return {
    __esModule: true,
    ...actualReactIntl,
    useIntl: () => ({
      formatMessage: ({ id }: { id: string }) => id,
    }),
  };
});

// Mock the leaf module directly — in the harness, Metro's `export *` creates
// non-configurable getter descriptors on barrel modules, so mutating the barrel
// fails silently. Mocking the leaf ensures the getter chain resolves to our mock.
jest.mock('@onekeyhq/components/src/actions/Toast', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
  },
}));

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();

  (globalThis as any).__borrowSignatureConfirmMock = {
    navigationToTxConfirm,
  };

  return {
    __esModule: true,
    useSignatureConfirm: () => ({
      navigationToTxConfirm,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    addEarnOrder: jest.fn(),
    getBorrowRepayWithCollateralQuote: jest.fn(),
    borrowBuildRepayWithCollateralTransaction: jest.fn(),
    borrowBuildSetupLutTransaction: jest.fn(),
    updateEarnOrder: jest.fn(),
    updateOrderStatusByTxId: jest.fn(),
    waitForSolTxFinalized: jest.fn(),
  };

  (globalThis as any).__borrowBackgroundMock = {
    serviceStaking,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn().mockResolvedValue(undefined),
  },
}));

// The confirming sheet is UI (pulls Dialog / expo openUrl); the hook only needs
// it as a side effect, so stub it for these logic tests.
jest.mock(
  '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult',
  () => ({
    __esModule: true,
    showDeFiActionTxConfirmDialog: jest.fn().mockResolvedValue(undefined),
  }),
);

import { act, renderHook } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';

import { useUniversalBorrowRepayWithCollateral } from './useUniversalBorrowHooks';

// In the harness, Metro's export * creates non-configurable getters so
// jest.mock('@onekeyhq/components') can't replace the Toast export.
// Instead, spy on the Toast object's error method directly — the object
// itself is a plain mutable const, only the module re-export is read-only.
const toastErrorSpy = jest.spyOn(Toast, 'error').mockImplementation(jest.fn());

const signatureConfirmMock = (globalThis as any)
  .__borrowSignatureConfirmMock as {
  navigationToTxConfirm: jest.Mock;
};
const backgroundMock = (globalThis as any).__borrowBackgroundMock as {
  serviceStaking: {
    addEarnOrder: jest.Mock;
    getBorrowRepayWithCollateralQuote: jest.Mock;
    borrowBuildRepayWithCollateralTransaction: jest.Mock;
    borrowBuildSetupLutTransaction: jest.Mock;
    updateEarnOrder: jest.Mock;
    updateOrderStatusByTxId: jest.Mock;
    waitForSolTxFinalized: jest.Mock;
  };
};

describe('useUniversalBorrowRepayWithCollateral', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    backgroundMock.serviceStaking.addEarnOrder.mockReset();
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockReset();
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockReset();
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockReset();
    backgroundMock.serviceStaking.updateEarnOrder.mockReset();
    backgroundMock.serviceStaking.updateOrderStatusByTxId.mockReset();
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockReset();
    toastErrorSpy.mockClear();
  });

  it('advances to repay after setup LUT finalizes even if repay confirm is cancelled', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'setup-order-id',
      },
    );
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      {
        routeKey: 'fresh-route',
        swapIn: '1.2',
      },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'repay-order-id',
      },
    );

    let confirmCount = 0;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onCancel,
        onSuccess,
      }: {
        onCancel?: () => void;
        onSuccess?: (
          data: Array<{
            decodedTx: { status: string; txid?: string };
            signedTx: { txid: string };
          }>,
        ) => void;
      }) => {
        confirmCount += 1;

        if (confirmCount === 1) {
          onSuccess?.([
            {
              decodedTx: {
                status: 'confirmed',
                txid: 'setup-tx-id',
              },
              signedTx: {
                txid: 'setup-tx-id',
              },
            },
          ]);
          return;
        }

        onCancel?.();
      },
    );

    const onSetupLutReadyForRepay = jest.fn();
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'hd-1--m/44',
      }),
    );

    await act(async () => {
      await result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
        collateralReserveAddress: 'collateral-reserve-address',
        needsSetupLut: true,
        onSetupLutReadyForRepay,
        onSuccess,
      });
    });

    expect(onSetupLutReadyForRepay).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      backgroundMock.serviceStaking.updateOrderStatusByTxId,
    ).toHaveBeenCalledWith({
      currentTxId: 'setup-tx-id',
      status: 'Confirmed',
    });
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(1);
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });

  it('keeps the repay confirm summary aligned with the fresh quote after setup LUT', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'setup-order-id',
      },
    );
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      {
        routeKey: 'fresh-route',
        swapIn: '1.25',
      },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'repay-order-id',
      },
    );

    let confirmCount = 0;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onCancel,
        onSuccess,
      }: {
        onCancel?: () => void;
        onSuccess?: (
          data: Array<{
            decodedTx: { status: string; txid?: string };
            signedTx: { txid: string };
          }>,
        ) => void;
      }) => {
        confirmCount += 1;

        if (confirmCount === 1) {
          onSuccess?.([
            {
              decodedTx: {
                status: 'confirmed',
                txid: 'setup-tx-id',
              },
              signedTx: {
                txid: 'setup-tx-id',
              },
            },
          ]);
          return;
        }

        onCancel?.();
      },
    );

    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'hd-1--m/44',
      }),
    );

    await act(async () => {
      await result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
        collateralReserveAddress: 'collateral-reserve-address',
        needsSetupLut: true,
        stakingInfo: {
          label: 'Repay' as any,
          protocol: 'Kamino',
          tags: [],
          send: {
            amount: '0.8',
            token: {} as any,
          },
        },
      });
    });

    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).toHaveBeenCalledWith({
      accountId: 'hd-1--m/44',
      amount: '1',
      collateralReserveAddress: 'collateral-reserve-address',
      marketAddress: 'market-address',
      networkId: 'sol--101',
      provider: 'kamino',
      repayAll: undefined,
      reserveAddress: 'reserve-address',
      routeKey: 'fresh-route',
      slippageBps: undefined,
    });

    const repayConfirmArgs =
      signatureConfirmMock.navigationToTxConfirm.mock.calls[1][0];
    expect(repayConfirmArgs.stakingInfo.send.amount).toBe('1.25');
  });

  it('passes borrow tracking stakingInfo to the setup LUT confirm step', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'setup-order-id',
      },
    );
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      {
        routeKey: 'fresh-route',
        swapIn: '1.1',
      },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'repay-order-id',
      },
    );

    let confirmCount = 0;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onCancel,
        onSuccess,
      }: {
        onCancel?: () => void;
        onSuccess?: (
          data: Array<{
            decodedTx: { status: string; txid?: string };
            signedTx: { txid: string };
          }>,
        ) => void;
      }) => {
        confirmCount += 1;

        if (confirmCount === 1) {
          onSuccess?.([
            {
              decodedTx: {
                status: 'confirmed',
                txid: 'setup-tx-id',
              },
              signedTx: {
                txid: 'setup-tx-id',
              },
            },
          ]);
          return;
        }

        onCancel?.();
      },
    );

    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'hd-1--m/44',
      }),
    );

    await act(async () => {
      await result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
        collateralReserveAddress: 'collateral-reserve-address',
        needsSetupLut: true,
        stakingInfo: {
          label: 'Repay' as any,
          protocol: 'Kamino',
          tags: ['Borrow', 'borrow:kamino:repay'],
          send: {
            amount: '0.9',
            token: {} as any,
          },
        },
      });
    });

    const setupConfirmArgs =
      signatureConfirmMock.navigationToTxConfirm.mock.calls[0][0];
    expect(setupConfirmArgs.stakingInfo).toEqual({
      label: 'Repay',
      protocol: 'Kamino',
      tags: ['Borrow', 'borrow:kamino:repay'],
      send: undefined,
      receive: undefined,
      orderId: 'setup-order-id',
    });
  });

  it('continues with the fresh setup route when LUT finalization polling times out', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'setup-order-id',
      },
    );
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'timeout',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      {
        routeKey: 'fresh-route-after-timeout',
        swapIn: '1.35',
      },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'repay-order-id',
      },
    );

    let confirmCount = 0;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onCancel,
        onSuccess,
      }: {
        onCancel?: () => void;
        onSuccess?: (
          data: Array<{
            decodedTx: { status: string; txid?: string };
            signedTx: { txid: string };
          }>,
        ) => void;
      }) => {
        confirmCount += 1;

        if (confirmCount === 1) {
          onSuccess?.([
            {
              decodedTx: {
                status: 'confirmed',
                txid: 'setup-tx-id',
              },
              signedTx: {
                txid: 'setup-tx-id',
              },
            },
          ]);
          return;
        }

        onCancel?.();
      },
    );

    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'hd-1--m/44',
      }),
    );

    await act(async () => {
      await result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
        collateralReserveAddress: 'collateral-reserve-address',
        needsSetupLut: true,
      });
    });

    expect(
      backgroundMock.serviceStaking.updateOrderStatusByTxId,
    ).toHaveBeenCalledWith({
      currentTxId: 'setup-tx-id',
      status: 'Pending',
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).toHaveBeenCalledWith({
      accountId: 'hd-1--m/44',
      amount: '1',
      collateralReserveAddress: 'collateral-reserve-address',
      marketAddress: 'market-address',
      networkId: 'sol--101',
      provider: 'kamino',
      repayAll: undefined,
      reserveAddress: 'reserve-address',
      routeKey: 'fresh-route-after-timeout',
      slippageBps: undefined,
    });
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });
});
