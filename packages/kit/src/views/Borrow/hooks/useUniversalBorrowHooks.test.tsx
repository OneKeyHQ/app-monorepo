/* eslint-disable import/first */

// The one-time DeFi risk disclaimer (OK-59196) gates every borrow trade hook.
// Accept it by default here; the rejection path has its own test.
const mockEnsureRiskAccepted = jest.fn(async () => true);
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog',
  () => ({
    __esModule: true,
    useEarnRiskWarningGate: () => mockEnsureRiskAccepted,
  }),
);

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
    message: jest.fn(),
  },
}));

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
    message: jest.fn(),
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

jest.mock('./borrowLutTaskRegistry', () => {
  const actual = jest.requireActual<typeof import('./borrowLutTaskRegistry')>(
    './borrowLutTaskRegistry',
  );
  type IController = { getTask: () => unknown };
  let registry = actual.createBorrowLutTaskRegistry<IController>();
  Object.defineProperty(globalThis, '__resetBorrowLutTestRegistry', {
    configurable: true,
    value: () => {
      registry = actual.createBorrowLutTaskRegistry<IController>();
    },
  });
  return {
    createBorrowLutTaskRegistry: () => ({
      find: (...args: Parameters<typeof registry.find>) =>
        registry.find(...args),
      findReservation: (...args: Parameters<typeof registry.findReservation>) =>
        registry.findReservation(...args),
      reserve: (...args: Parameters<typeof registry.reserve>) => {
        const reservation = registry.reserve(...args);
        if (reservation.type === 'reserved') {
          Object.defineProperty(globalThis, '__borrowLastLutController', {
            configurable: true,
            value: args[1],
          });
        }
        return reservation;
      },
      replace: (...args: Parameters<typeof registry.replace>) =>
        registry.replace(...args),
      release: (...args: Parameters<typeof registry.release>) =>
        registry.release(...args),
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    addEarnOrder: jest.fn(),
    getBorrowRepayWithCollateralQuote: jest.fn(),
    borrowBuildRepayWithCollateralTransaction: jest.fn(),
    borrowBuildSetupLutTransaction: jest.fn(),
    borrowBuildSupplyTransaction: jest.fn(),
    updateEarnOrder: jest.fn(),
    updateOrderStatusByTxId: jest.fn(),
    waitForSolTxFinalized: jest.fn(),
  };

  const serviceAccount = {
    getAccountAddressForApi: jest
      .fn()
      .mockResolvedValue('test-account-address'),
  };
  (globalThis as any).__borrowBackgroundMock = {
    serviceStaking,
    serviceAccount,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
      serviceAccount,
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@onekeyhq/shared/src/utils/timerUtils').default,
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

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';
import { showDeFiActionTxConfirmDialog } from '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import {
  useUniversalBorrowRepay,
  useUniversalBorrowRepayWithCollateral,
  useUniversalBorrowSupply,
  useUniversalBorrowWithdraw,
} from './useUniversalBorrowHooks';

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
  serviceAccount: { getAccountAddressForApi: jest.Mock };
  serviceStaking: {
    addEarnOrder: jest.Mock;
    getBorrowRepayWithCollateralQuote: jest.Mock;
    borrowBuildRepayWithCollateralTransaction: jest.Mock;
    borrowBuildSetupLutTransaction: jest.Mock;
    updateEarnOrder: jest.Mock;
    updateOrderStatusByTxId: jest.Mock;
    waitForSolTxFinalized: jest.Mock;
    borrowBuildSupplyTransaction: jest.Mock;
  };
};

describe('useUniversalBorrowRepayWithCollateral', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        __resetBorrowLutTestRegistry: () => void;
      }
    ).__resetBorrowLutTestRegistry();
    jest.mocked(showDeFiActionTxConfirmDialog).mockClear();
    backgroundMock.serviceAccount.getAccountAddressForApi
      .mockReset()
      .mockResolvedValue('test-account-address');
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
    for (const request of [
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ]) {
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedAccountAddress: 'test-account-address',
        }),
      );
    }
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
      expectedAccountAddress: 'test-account-address',
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
      expectedAccountAddress: 'test-account-address',
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

  it('continues a finalized setup without an order id without updating a local order', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}' },
    );
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.updateOrderStatusByTxId.mockRejectedValue(
      new Error('local order unavailable'),
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      { routeKey: 'fresh-route', swapIn: '1' },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order' },
    );
    let count = 0;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onSuccess,
        onCancel,
      }: {
        onSuccess?: (data: unknown[]) => void;
        onCancel?: () => void;
      }) => {
        count += 1;
        if (count === 1)
          onSuccess?.([
            {
              decodedTx: { status: 'Pending', txid: 'setup-tx' },
              signedTx: { txid: 'setup-tx' },
            },
          ]);
        else onCancel?.();
      },
    );
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    await act(async () => {
      await result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: true,
      });
    });
    expect(
      backgroundMock.serviceStaking.updateOrderStatusByTxId,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).toHaveBeenCalledTimes(1);
    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).toHaveBeenCalledTimes(1);
  });

  it.each(['local-write-failed', 'remote-unknown'] as const)(
    'does not rebuild a submitted LUT after order status becomes %s',
    async (failure) => {
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'setup-order-id' },
      );
      if (failure === 'local-write-failed') {
        backgroundMock.serviceStaking.addEarnOrder.mockRejectedValue(
          new Error('local storage failed'),
        );
      } else {
        backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
          localStatus: 'saved',
          remoteStatus: 'failed',
        });
      }
      backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
        'finalized',
      );
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
        { routeKey: 'fresh-route', swapIn: '1' },
      );
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'repay-order-id' },
      );
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async ({
          stakingInfo,
          onSuccess,
          onCancel,
        }: {
          stakingInfo?: { orderId?: string };
          onSuccess?: (data: unknown[]) => void;
          onCancel?: () => void;
        }) => {
          if (stakingInfo?.orderId === 'repay-order-id') onCancel?.();
          else
            onSuccess?.([
              {
                decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
                signedTx: { txid: 'setup-tx-id' },
              },
            ]);
        },
      );
      const { result } = renderHook(() =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId: 'hd-1--m/44',
        }),
      );
      const params = {
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
        collateralReserveAddress: 'collateral-reserve-address',
        needsSetupLut: true,
        stakingInfo: {
          protocol: 'Kamino',
          label: EEarnLabels.Repay,
          tags: ['borrow'],
        },
      };
      await act(async () => {
        await result.current(params);
      });
      await act(async () => {
        await result.current({ ...params, amount: '2' });
      });
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it('retries a proven local-only setup recording without rebuilding or reposting an unknown order', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order-id' },
    );
    backgroundMock.serviceStaking.addEarnOrder
      .mockResolvedValueOnce({
        localStatus: 'failed',
        remoteStatus: 'notAttempted',
      })
      .mockResolvedValueOnce({ localStatus: 'saved', remoteStatus: 'synced' });
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      { routeKey: 'fresh-route', swapIn: '1' },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order-id' },
    );
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        stakingInfo,
        onSuccess,
        onCancel,
      }: {
        stakingInfo?: { orderId?: string };
        onSuccess: (data: unknown[]) => void;
        onCancel: () => void;
      }) => {
        if (stakingInfo?.orderId === 'repay-order-id') onCancel();
        else
          onSuccess([
            {
              decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
              signedTx: { txid: 'setup-tx-id' },
            },
          ]);
      },
    );
    const params = {
      amount: '1',
      provider: 'kamino',
      marketAddress: 'market',
      reserveAddress: 'reserve',
      collateralReserveAddress: 'collateral',
      needsSetupLut: true,
      stakingInfo: {
        protocol: 'Kamino',
        label: EEarnLabels.Repay,
        tags: ['borrow'],
      },
    };
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    await act(async () => {
      expect(await result.current(params)).toBe(false);
    });
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current(params)).toBe(false);
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(2);
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({ txId: 'setup-tx-id' }),
      { remoteSync: 'once' },
    );
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).toHaveBeenCalledTimes(1);
  });

  it('reuses the submitted setup after remount and requotes the new amount without reposting the order', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order-id' },
    );
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'failed',
    });
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'timeout',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      { routeKey: 'fresh-route', swapIn: '1' },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order-id' },
    );
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        stakingInfo,
        onSuccess,
        onCancel,
      }: {
        stakingInfo?: { orderId?: string };
        onSuccess: (data: unknown[]) => void;
        onCancel: () => void;
      }) => {
        if (stakingInfo?.orderId === 'repay-order-id') onCancel();
        else
          onSuccess([
            {
              decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
              signedTx: { txid: 'setup-tx-id' },
            },
          ]);
      },
    );
    const params = {
      amount: '1',
      provider: 'kamino',
      marketAddress: 'market',
      reserveAddress: 'reserve',
      collateralReserveAddress: 'collateral',
      needsSetupLut: true,
      stakingInfo: {
        protocol: 'Kamino',
        label: EEarnLabels.Repay,
        tags: ['borrow'],
      },
    };
    const first = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    await act(async () => {
      expect(await first.result.current(params)).toBe(false);
    });
    first.unmount();
    const second = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    await act(async () => {
      expect(await second.result.current({ ...params, amount: '2' })).toBe(
        false,
      );
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(1);
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).toHaveBeenLastCalledWith(expect.objectContaining({ amount: '2' }));
  });

  it('does not inspect another account owner’s LUT task for the same address', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order-id' },
    );
    let setup:
      | { onBeforeSend: () => Promise<void>; onCancel: () => void }
      | undefined;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: {
        onBeforeSend: () => Promise<void>;
        onCancel: () => void;
      }) => {
        setup = params;
      },
    );
    const params = {
      amount: '1',
      provider: 'kamino',
      marketAddress: 'market',
      reserveAddress: 'reserve',
      collateralReserveAddress: 'collateral',
      needsSetupLut: true,
      stakingInfo: {
        protocol: 'Kamino',
        label: EEarnLabels.Repay,
        tags: ['borrow'],
      },
    };
    const first = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let running: Promise<boolean> | undefined;
    act(() => {
      running = first.result.current(params);
    });
    await waitFor(() => expect(setup).toBeDefined());
    await act(async () => {
      await setup?.onBeforeSend();
      setup?.onCancel();
      expect(await running).toBe(false);
    });
    first.unmount();
    const controller = (
      globalThis as typeof globalThis & {
        __borrowLastLutController?: { getTask: () => unknown };
      }
    ).__borrowLastLutController;
    expect(controller).toBeDefined();
    if (!controller) return;
    const getTask = jest.spyOn(controller, 'getTask');
    const other = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-b',
      }),
    );
    await act(async () =>
      expect(await other.result.current({ ...params, amount: '2' })).toBe(
        false,
      ),
    );
    expect(getTask).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
    ).toHaveBeenCalledTimes(1);
  });

  it('does not rebuild while setup is uncertain, then records its late hash and resumes with a fresh intent', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order-id' },
    );
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'timeout',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      { routeKey: 'fresh-route', swapIn: '1' },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order-id' },
    );
    let setup:
      | {
          onBeforeSend: () => Promise<void>;
          onCancel: () => void;
          onSuccess: (data: unknown[]) => void;
        }
      | undefined;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: {
        stakingInfo?: { orderId?: string };
        onBeforeSend: () => Promise<void>;
        onCancel: () => void;
        onSuccess: (data: unknown[]) => void;
      }) => {
        if (params.stakingInfo?.orderId === 'repay-order-id') params.onCancel();
        else setup = params;
      },
    );
    const params = {
      amount: '1',
      provider: 'kamino',
      marketAddress: 'market',
      reserveAddress: 'reserve',
      collateralReserveAddress: 'collateral',
      needsSetupLut: true,
      stakingInfo: {
        protocol: 'Kamino',
        label: EEarnLabels.Repay,
        tags: ['borrow'],
      },
    };
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let first: Promise<boolean> | undefined;
    act(() => {
      first = result.current(params);
    });
    await waitFor(() => expect(setup).toBeDefined());
    await act(async () => {
      await setup?.onBeforeSend();
      setup?.onCancel();
      expect(await first).toBe(false);
    });
    await act(async () => {
      expect(await result.current({ ...params, amount: '2' })).toBe(false);
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).not.toHaveBeenCalled();
    await act(async () => {
      setup?.onSuccess([
        {
          decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
          signedTx: { txid: 'setup-tx-id' },
        },
      ]);
    });
    await waitFor(() =>
      expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(
        1,
      ),
    );
    await act(async () => {
      expect(await result.current({ ...params, amount: '2' })).toBe(false);
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(1);
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).toHaveBeenLastCalledWith(expect.objectContaining({ amount: '2' }));
  });

  it('allows a new setup route after cancelling the previous setup before sending', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order-id' },
    );
    const confirmations: {
      onBeforeSend: () => Promise<void>;
      onCancel: () => void;
    }[] = [];
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: {
        onBeforeSend: () => Promise<void>;
        onCancel: () => void;
      }) => {
        confirmations.push(params);
      },
    );
    const params = {
      amount: '1',
      provider: 'kamino',
      marketAddress: 'market',
      reserveAddress: 'reserve',
      collateralReserveAddress: 'collateral-a',
      needsSetupLut: true,
    };
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let first: Promise<boolean> | undefined;
    act(() => {
      first = result.current(params);
    });
    await waitFor(() => expect(confirmations).toHaveLength(1));
    await act(async () => {
      confirmations[0].onCancel();
      expect(await first).toBe(false);
    });
    let second: Promise<boolean> | undefined;
    act(() => {
      second = result.current({
        ...params,
        collateralReserveAddress: 'collateral-b',
      });
    });
    await waitFor(() => expect(confirmations).toHaveLength(2));
    expect(
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({ collateralReserveAddress: 'collateral-b' }),
    );
    await expect(confirmations[0].onBeforeSend()).rejects.toThrow();
    await act(async () => {
      confirmations[1].onCancel();
      expect(await second).toBe(false);
    });
  });

  it.each(['direct-route', 'late-success'] as const)(
    'keeps the existing setup reservation for %s after cancellation',
    async (scenario) => {
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'setup-order-id' },
      );
      backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
        localStatus: 'saved',
        remoteStatus: 'synced',
      });
      let confirmation:
        | {
            onCancel: () => void;
            onSuccess: (data: unknown[]) => void;
          }
        | undefined;
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async (params: {
          onCancel: () => void;
          onSuccess: (data: unknown[]) => void;
        }) => {
          confirmation = params;
        },
      );
      const params = {
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral-a',
        needsSetupLut: true,
      };
      const { result } = renderHook(() =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId: 'account-a',
        }),
      );
      let first: Promise<boolean> | undefined;
      act(() => {
        first = result.current(params);
      });
      await waitFor(() => expect(confirmation).toBeDefined());
      await act(async () => {
        confirmation?.onCancel();
        expect(await first).toBe(false);
      });
      if (scenario === 'late-success') {
        await act(async () => {
          confirmation?.onSuccess([
            {
              decodedTx: { txid: 'late-setup', status: 'Pending' },
              signedTx: { txid: 'late-setup' },
            },
          ]);
        });
        await waitFor(() =>
          expect(
            backgroundMock.serviceStaking.addEarnOrder,
          ).toHaveBeenCalledTimes(1),
        );
      }
      await act(async () => {
        expect(
          await result.current({
            ...params,
            collateralReserveAddress: 'collateral-b',
            needsSetupLut: scenario !== 'direct-route',
          }),
        ).toBe(false);
      });
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenCalledTimes(1);
      expect(
        backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    { remoteStatus: 'synced', finality: 'finalized' },
    { remoteStatus: 'synced', finality: 'failed' },
    { remoteStatus: 'failed', finality: 'finalized' },
    { remoteStatus: 'failed', finality: 'failed' },
  ])(
    'holds a different collateral route until setup is $finality when order sync is $remoteStatus',
    async ({ remoteStatus, finality }) => {
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'setup-order-id' },
      );
      backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
        localStatus: 'saved',
        remoteStatus,
      });
      backgroundMock.serviceStaking.waitForSolTxFinalized
        .mockResolvedValueOnce('timeout')
        .mockResolvedValueOnce('timeout')
        .mockResolvedValue(finality);
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
        { routeKey: 'fresh-route', swapIn: '1' },
      );
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'repay-order-id' },
      );
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async ({
          stakingInfo,
          onSuccess,
          onCancel,
        }: {
          stakingInfo?: { orderId?: string };
          onSuccess: (data: unknown[]) => void;
          onCancel: () => void;
        }) => {
          if (stakingInfo?.orderId === 'repay-order-id') onCancel();
          else
            onSuccess([
              {
                decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
                signedTx: { txid: 'setup-tx-id' },
              },
            ]);
        },
      );
      const params = {
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral-a',
        needsSetupLut: true,
        stakingInfo: {
          protocol: 'Kamino',
          label: EEarnLabels.Repay,
          tags: ['borrow'],
        },
      };
      const { result } = renderHook(() =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId: 'account-a',
        }),
      );
      await act(async () => {
        expect(await result.current(params)).toBe(false);
      });
      await act(async () => {
        expect(
          await result.current({
            ...params,
            collateralReserveAddress: 'collateral-b',
          }),
        ).toBe(false);
      });
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenCalledTimes(1);
      await act(async () => {
        expect(
          await result.current({
            ...params,
            collateralReserveAddress: 'collateral-b',
          }),
        ).toBe(false);
      });
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenCalledTimes(2);
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({ collateralReserveAddress: 'collateral-b' }),
      );
      expect(
        backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
      ).toHaveBeenCalledTimes(finality === 'failed' ? 1 : 2);
    },
  );

  it.each(['cancelled', 'completed', 'unknown'] as const)(
    'switches collateral after failed setup order sync only when the repay is resolved (%s)',
    async (repayOutcome) => {
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'setup-order-id' },
      );
      backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
        localStatus: 'saved',
        remoteStatus: 'failed',
      });
      backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
        'finalized',
      );
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
        { routeKey: 'fresh-route', swapIn: '1' },
      );
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'repay-order-id' },
      );
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async ({
          stakingInfo,
          onBeforeSend,
          onSuccess,
          onCancel,
          onFail,
        }: {
          stakingInfo?: { orderId?: string };
          onBeforeSend: () => Promise<void>;
          onSuccess: (data: unknown[]) => void;
          onCancel: () => void;
          onFail: (error: Error) => void;
        }) => {
          const isRepay = stakingInfo?.orderId === 'repay-order-id';
          if (isRepay && repayOutcome === 'cancelled') {
            onCancel();
            return;
          }
          await onBeforeSend();
          if (isRepay && repayOutcome === 'unknown') {
            onFail(new Error('Broadcast response lost'));
            return;
          }
          const txid = isRepay ? 'repay-tx-id' : 'setup-tx-id';
          onSuccess([
            {
              decodedTx: { txid, status: 'Pending' },
              signedTx: { txid },
            },
          ]);
        },
      );
      const params = {
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral-a',
        needsSetupLut: true,
        stakingInfo: {
          protocol: 'Kamino',
          label: EEarnLabels.Repay,
          tags: ['borrow'],
        },
      };
      const { result } = renderHook(() =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId: 'account-a',
        }),
      );
      await act(async () => {
        expect(await result.current(params)).toBe(repayOutcome === 'completed');
      });
      await act(async () => {
        expect(await result.current({ ...params, amount: '2' })).toBe(
          repayOutcome === 'completed',
        );
      });
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenCalledTimes(1);
      expect(
        backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
      ).toHaveBeenCalledTimes(repayOutcome === 'unknown' ? 1 : 2);
      expect(
        backgroundMock.serviceStaking.waitForSolTxFinalized,
      ).toHaveBeenCalledTimes(1);
      await act(async () => {
        expect(
          await result.current({
            ...params,
            collateralReserveAddress: 'collateral-b',
          }),
        ).toBe(repayOutcome === 'completed');
      });
      const canSwitch = repayOutcome !== 'unknown';
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenCalledTimes(canSwitch ? 2 : 1);
      expect(
        backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          collateralReserveAddress: canSwitch ? 'collateral-b' : 'collateral-a',
        }),
      );
      expect(
        backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
      ).toHaveBeenCalledTimes(canSwitch ? 3 : 1);
    },
  );

  it('never reuses the pre-setup route if the fresh quote omits its route key', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order-id' },
    );
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      { swapIn: '1' },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order-id' },
    );
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        stakingInfo,
        onSuccess,
        onCancel,
      }: {
        stakingInfo?: { orderId?: string };
        onSuccess: (data: unknown[]) => void;
        onCancel: () => void;
      }) => {
        if (stakingInfo?.orderId === 'repay-order-id') onCancel();
        else
          onSuccess([
            {
              decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
              signedTx: { txid: 'setup-tx-id' },
            },
          ]);
      },
    );
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    await act(async () => {
      await result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: true,
        routeKey: 'stale-route',
        stakingInfo: {
          protocol: 'Kamino',
          label: EEarnLabels.Repay,
          tags: ['borrow'],
        },
      });
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).toHaveBeenCalledWith(expect.objectContaining({ routeKey: undefined }));
  });

  it('allows explicit setup retry after an authoritative on-chain failure', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order-id' },
    );
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    backgroundMock.serviceStaking.waitForSolTxFinalized
      .mockResolvedValueOnce('failed')
      .mockResolvedValue('finalized');
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockResolvedValue(
      { routeKey: 'fresh-route', swapIn: '1' },
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order-id' },
    );
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        stakingInfo,
        onSuccess,
        onCancel,
      }: {
        stakingInfo?: { orderId?: string };
        onSuccess: (data: unknown[]) => void;
        onCancel: () => void;
      }) => {
        if (stakingInfo?.orderId === 'repay-order-id') onCancel();
        else
          onSuccess([
            {
              decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
              signedTx: { txid: 'setup-tx-id' },
            },
          ]);
      },
    );
    const params = {
      amount: '1',
      provider: 'kamino',
      marketAddress: 'market',
      reserveAddress: 'reserve',
      collateralReserveAddress: 'collateral',
      needsSetupLut: true,
      stakingInfo: {
        protocol: 'Kamino',
        label: EEarnLabels.Repay,
        tags: ['borrow'],
      },
    };
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    await act(async () => {
      expect(await result.current(params)).toBe(false);
    });
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current(params)).toBe(false);
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction,
    ).toHaveBeenCalledTimes(2);
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['finality', 'account'],
    ['quote', 'account'],
    ['finality', 'network'],
    ['quote', 'network'],
    ['finality', 'address'],
    ['quote', 'address'],
    ['finality', 'form'],
    ['quote', 'form'],
  ] as const)(
    'does not construct or open repay after %s when the %s changes',
    async (stage, changed) => {
      let formCurrent = true;
      let release: (value: unknown) => void = () => undefined;
      const pending = new Promise((resolve) => {
        release = resolve;
      });
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'setup-order-id' },
      );
      backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
        localStatus: 'saved',
        remoteStatus: 'synced',
      });
      backgroundMock.serviceStaking.waitForSolTxFinalized.mockImplementation(
        () => (stage === 'finality' ? pending : Promise.resolve('finalized')),
      );
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockImplementation(
        () =>
          stage === 'quote'
            ? pending
            : Promise.resolve({ routeKey: 'fresh-route', swapIn: '1' }),
      );
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'repay-order-id' },
      );
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async ({
          onSuccess,
          onCancel,
        }: {
          onSuccess?: (data: unknown[]) => void;
          onCancel?: () => void;
        }) => {
          if (onSuccess)
            onSuccess([
              {
                decodedTx: { txid: 'setup-tx-id', status: 'Pending' },
                signedTx: { txid: 'setup-tx-id' },
              },
            ]);
          else onCancel?.();
        },
      );
      const { result, rerender } = renderHook(
        (identity: {
          accountId: string;
          networkId: string;
          accountAddress: string;
        }) => useUniversalBorrowRepayWithCollateral(identity),
        {
          initialProps: {
            accountId: 'account-a',
            networkId: 'sol--101',
            accountAddress: 'test-account-address',
          },
        },
      );
      let operation: Promise<boolean> | undefined;
      act(() => {
        operation = result.current({
          amount: '1',
          provider: 'kamino',
          marketAddress: 'market-address',
          reserveAddress: 'reserve-address',
          collateralReserveAddress: 'collateral-reserve-address',
          needsSetupLut: true,
          isActionCurrent: () => formCurrent,
        });
      });
      const target =
        stage === 'finality'
          ? backgroundMock.serviceStaking.waitForSolTxFinalized
          : backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote;
      await waitFor(() => expect(target).toHaveBeenCalledTimes(1));
      if (changed === 'form') formCurrent = false;
      else
        rerender({
          accountId: changed === 'account' ? 'account-b' : 'account-a',
          networkId: changed === 'network' ? 'sol--102' : 'sol--101',
          accountAddress:
            changed === 'address'
              ? 'different-address'
              : 'test-account-address',
        });
      await act(async () => {
        release(
          stage === 'finality'
            ? 'timeout'
            : { routeKey: 'fresh-route', swapIn: '1' },
        );
        await operation;
      });
      expect(
        backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
      ).not.toHaveBeenCalled();
      expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledTimes(
        1,
      );
    },
  );
  it('rechecks a same-ID address change before building a quoted repay', async () => {
    let releaseQuote: (value: unknown) => void = () => undefined;
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order' },
    );
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseQuote = resolve;
        }),
    );
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({ onSuccess }: { onSuccess: (data: unknown[]) => void }) => {
        onSuccess([
          {
            decodedTx: { txid: 'setup-tx', status: 'Pending' },
            signedTx: { txid: 'setup-tx' },
          },
        ]);
      },
    );
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let operation: Promise<boolean> | undefined;
    act(() => {
      operation = result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: true,
      });
    });
    await waitFor(() =>
      expect(
        backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
      ).toHaveBeenCalledTimes(1),
    );
    backgroundMock.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      'different-address',
    );
    await act(async () => {
      releaseQuote({ routeKey: 'route', swapIn: '1' });
      expect(await operation).toBe(false);
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledTimes(1);
  });

  it('revalidates the owner before each send without blocking a repeated valid attempt', async () => {
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order' },
    );
    let beforeSend: (() => Promise<void>) | undefined;
    let cancel: (() => void) | undefined;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: {
        onBeforeSend: () => Promise<void>;
        onCancel: () => void;
      }) => {
        beforeSend = params.onBeforeSend;
        cancel = params.onCancel;
      },
    );
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let operation: Promise<boolean> | undefined;
    act(() => {
      operation = result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: false,
      });
    });
    await waitFor(() => expect(beforeSend).toBeDefined());
    await expect(beforeSend?.()).resolves.toBeUndefined();
    await expect(beforeSend?.()).resolves.toBeUndefined();
    backgroundMock.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      'different-address',
    );
    await expect(beforeSend?.()).rejects.toThrow(
      'Borrow transaction confirmation expired',
    );
    await act(async () => {
      cancel?.();
      expect(await operation).toBe(false);
    });
  });

  it('rejects a stale form intent before the confirmation sends', async () => {
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'repay-order' },
    );
    let beforeSend: (() => Promise<void>) | undefined;
    let cancel: (() => void) | undefined;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: {
        onBeforeSend: () => Promise<void>;
        onCancel: () => void;
      }) => {
        beforeSend = params.onBeforeSend;
        cancel = params.onCancel;
      },
    );
    let formCurrent = true;
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let operation: Promise<boolean> | undefined;
    act(() => {
      operation = result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: false,
        isActionCurrent: () => formCurrent,
      });
    });
    await waitFor(() => expect(beforeSend).toBeDefined());
    formCurrent = false;
    await expect(beforeSend?.()).rejects.toThrow(
      'Borrow transaction confirmation expired',
    );
    await act(async () => {
      cancel?.();
      expect(await operation).toBe(false);
    });
    expect(backgroundMock.serviceStaking.addEarnOrder).not.toHaveBeenCalled();
  });

  it('records an already submitted setup after the account scope changes', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order' },
    );
    let success: ((data: unknown[]) => void) | undefined;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: { onSuccess: (data: unknown[]) => void }) => {
        success = params.onSuccess;
      },
    );
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId,
        }),
      { initialProps: { accountId: 'account-a' } },
    );
    let operation: Promise<boolean> | undefined;
    act(() => {
      operation = result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: true,
      });
    });
    await waitFor(() => expect(success).toBeDefined());
    rerender({ accountId: 'account-b' });
    await act(async () => {
      success?.([
        {
          decodedTx: { txid: 'setup-tx', status: 'Pending' },
          signedTx: { txid: 'setup-tx' },
        },
      ]);
      expect(await operation).toBe(false);
    });
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'setup-order',
        networkId: 'sol--101',
        txId: 'setup-tx',
      }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).not.toHaveBeenCalled();
  });

  it('records a late setup success once after cancellation without continuing the flow', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order' },
    );
    let success: ((data: unknown[]) => void) | undefined;
    let cancel: (() => void) | undefined;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: {
        onSuccess: (data: unknown[]) => void;
        onCancel: () => void;
      }) => {
        success = params.onSuccess;
        cancel = params.onCancel;
      },
    );
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let operation: Promise<boolean> | undefined;
    act(() => {
      operation = result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: true,
      });
    });
    await waitFor(() => expect(success).toBeDefined());
    await act(async () => {
      cancel?.();
      expect(await operation).toBe(false);
    });
    const submitted = [
      {
        decodedTx: { txid: 'setup-tx', status: 'Pending' },
        signedTx: { txid: 'setup-tx' },
      },
    ];
    await act(async () => {
      success?.(submitted);
      success?.(submitted);
    });
    await waitFor(() =>
      expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(
        1,
      ),
    );
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'setup-order', txId: 'setup-tx' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).not.toHaveBeenCalled();
  });

  it.each(['setup', 'repay'] as const)(
    'records a verified late %s broadcast against its own order without continuing',
    async (step) => {
      backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
        {
          tx: '{}',
          orderId: 'setup-order',
        },
      );
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
        {
          tx: '{}',
          orderId: 'repay-order',
        },
      );
      backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
        localStatus: 'saved',
        remoteStatus: 'synced',
      });
      let confirmation:
        | {
            onBeforeSend: () => Promise<void>;
            onCancel: () => void;
            onSuccess: (data: unknown[]) => void;
            onLateBroadcastAccepted?: (fact: {
              uuid: string;
              accountId: string;
              networkId: string;
              txid: string;
            }) => Promise<void> | void;
          }
        | undefined;
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async (params: typeof confirmation) => {
          confirmation = params;
        },
      );
      const onSuccess = jest.fn();
      const { result } = renderHook(() =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId: 'account-a',
        }),
      );
      let operation: Promise<boolean> | undefined;
      act(() => {
        operation = result.current({
          amount: '1',
          provider: 'kamino',
          marketAddress: 'market',
          reserveAddress: 'reserve',
          collateralReserveAddress: 'collateral',
          needsSetupLut: step === 'setup',
          onSuccess,
        });
      });
      await waitFor(() => expect(confirmation).toBeDefined());
      await act(async () => {
        await confirmation?.onBeforeSend();
        confirmation?.onCancel();
        expect(await operation).toBe(false);
      });
      expect(confirmation?.onLateBroadcastAccepted).toBeDefined();
      await act(async () => {
        await confirmation?.onLateBroadcastAccepted?.({
          uuid: 'request-1',
          accountId: 'other-account',
          networkId: 'sol--101',
          txid: `${step}-late`,
        });
      });
      expect(backgroundMock.serviceStaking.addEarnOrder).not.toHaveBeenCalled();
      await act(async () => {
        await confirmation?.onLateBroadcastAccepted?.({
          uuid: 'request-1',
          accountId: 'account-a',
          networkId: 'sol--101',
          txid: `${step}-late`,
        });
        await confirmation?.onLateBroadcastAccepted?.({
          uuid: 'request-1',
          accountId: 'account-a',
          networkId: 'sol--101',
          txid: `${step}-late`,
        });
        confirmation?.onSuccess([
          {
            decodedTx: { txid: `${step}-late`, status: 'Pending' },
            signedTx: { txid: `${step}-late` },
          },
        ]);
      });
      await waitFor(() =>
        expect(
          backgroundMock.serviceStaking.addEarnOrder,
        ).toHaveBeenCalledTimes(1),
      );
      expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: `${step}-order`,
          txId: `${step}-late`,
        }),
        { remoteSync: 'once', preserveExistingTx: true },
      );
      expect(onSuccess).not.toHaveBeenCalled();
      expect(showDeFiActionTxConfirmDialog).not.toHaveBeenCalled();
      expect(
        backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
      ).not.toHaveBeenCalled();
    },
  );

  it('does not post a cancelled repay twice when success precedes its verified late fact', async () => {
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      {
        tx: '{}',
        orderId: 'repay-order',
      },
    );
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    let confirmation:
      | {
          onBeforeSend: () => Promise<void>;
          onCancel: () => void;
          onSuccess: (data: unknown[]) => void;
          onLateBroadcastAccepted: (fact: {
            uuid: string;
            accountId: string;
            networkId: string;
            txid: string;
          }) => Promise<void>;
        }
      | undefined;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async (params: typeof confirmation) => {
        confirmation = params;
      },
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    let operation: Promise<boolean> | undefined;
    act(() => {
      operation = result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        collateralReserveAddress: 'collateral',
        needsSetupLut: false,
        onSuccess,
      });
    });
    await waitFor(() => expect(confirmation).toBeDefined());
    await act(async () => {
      await confirmation?.onBeforeSend();
      confirmation?.onCancel();
      expect(await operation).toBe(false);
      confirmation?.onSuccess([
        {
          decodedTx: { txid: 'repay-late', status: 'Pending' },
          signedTx: { txid: 'repay-late' },
        },
      ]);
      await confirmation?.onLateBroadcastAccepted({
        uuid: 'request-1',
        accountId: 'account-a',
        networkId: 'sol--101',
        txid: 'repay-late',
      });
    });
    await waitFor(() =>
      expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(
        1,
      ),
    );
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'repay-order', txId: 'repay-late' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(showDeFiActionTxConfirmDialog).not.toHaveBeenCalled();
  });

  it('records synchronous success after cancellation without advancing or opening the repay', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      { tx: '{}', orderId: 'setup-order' },
    );
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onCancel,
        onSuccess,
      }: {
        onCancel: () => void;
        onSuccess: (data: unknown[]) => void;
      }) => {
        onCancel();
        onSuccess([
          {
            decodedTx: { txid: 'setup-tx', status: 'Pending' },
            signedTx: { txid: 'setup-tx' },
          },
        ]);
      },
    );
    const { result } = renderHook(() =>
      useUniversalBorrowRepayWithCollateral({
        networkId: 'sol--101',
        accountId: 'account-a',
      }),
    );
    await act(async () => {
      expect(
        await result.current({
          amount: '1',
          provider: 'kamino',
          marketAddress: 'market',
          reserveAddress: 'reserve',
          collateralReserveAddress: 'collateral',
          needsSetupLut: true,
        }),
      ).toBe(false);
    });
    await waitFor(() =>
      expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(
        1,
      ),
    );
    expect(
      backgroundMock.serviceStaking.waitForSolTxFinalized,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.getBorrowRepayWithCollateralQuote,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).not.toHaveBeenCalled();
  });

  it.each(['unmount', 'form-change'] as const)(
    'records a late repay after %s without opening a stale result sheet',
    async (change) => {
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
        { tx: '{}', orderId: 'repay-order' },
      );
      let confirmation:
        | {
            onBeforeSend: () => Promise<void>;
            onCancel: () => void;
            onSuccess: (data: unknown[]) => void;
          }
        | undefined;
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async (params: {
          onBeforeSend: () => Promise<void>;
          onCancel: () => void;
          onSuccess: (data: unknown[]) => void;
        }) => {
          confirmation = params;
        },
      );
      const onSuccess = jest.fn();
      let formCurrent = true;
      const { result, unmount } = renderHook(() =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId: 'account-a',
        }),
      );
      let operation: Promise<boolean> | undefined;
      act(() => {
        operation = result.current({
          amount: '1',
          provider: 'kamino',
          marketAddress: 'market',
          reserveAddress: 'reserve',
          collateralReserveAddress: 'collateral',
          needsSetupLut: false,
          stakingInfo: {
            protocol: 'Kamino',
            label: EEarnLabels.Repay,
            tags: ['borrow'],
          },
          isActionCurrent: () => formCurrent,
          onSuccess,
        });
      });
      await waitFor(() => expect(confirmation).toBeDefined());
      await act(async () => {
        await confirmation?.onBeforeSend();
        confirmation?.onCancel();
        expect(await operation).toBe(false);
      });
      if (change === 'unmount') unmount();
      else formCurrent = false;
      await act(async () => {
        confirmation?.onSuccess([
          {
            decodedTx: { txid: 'repay-tx', status: 'Pending' },
            signedTx: { txid: 'repay-tx' },
          },
        ]);
      });
      await waitFor(() =>
        expect(
          backgroundMock.serviceStaking.addEarnOrder,
        ).toHaveBeenCalledTimes(1),
      );
      expect(showDeFiActionTxConfirmDialog).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );
});

describe('one-time DeFi risk disclaimer gate (OK-59196)', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    backgroundMock.serviceStaking.borrowBuildSupplyTransaction.mockReset();
    mockEnsureRiskAccepted.mockReset();
  });

  it('builds and hands off the supply transaction once accepted', async () => {
    mockEnsureRiskAccepted.mockResolvedValue(true);
    backgroundMock.serviceStaking.borrowBuildSupplyTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'supply-order-id',
      },
    );

    const { result } = renderHook(() =>
      useUniversalBorrowSupply({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
      }),
    );

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current({
        amount: '1',
        provider: 'aave',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
      });
    });

    expect(started).toBe(true);
    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledTimes(1);
  });

  it('returns false and builds nothing when the disclaimer is rejected', async () => {
    mockEnsureRiskAccepted.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useUniversalBorrowSupply({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
      }),
    );

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current({
        amount: '1',
        provider: 'aave',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
      });
    });

    expect(started).toBe(false);
    expect(
      backgroundMock.serviceStaking.borrowBuildSupplyTransaction,
    ).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
  });
});

describe('rejected disclaimer stays observable to the caller', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    mockEnsureRiskAccepted.mockReset();
    mockEnsureRiskAccepted.mockResolvedValue(false);
  });

  // The lending action dialog takes its submit guard before calling and
  // releases it from these callbacks, so "no callback + no throw" is exactly
  // the contract it relies on to know it must release the guard itself.
  it.each([
    ['withdraw', useUniversalBorrowWithdraw],
    ['repay', useUniversalBorrowRepay],
  ])('%s returns false without firing any callback', async (_name, useHook) => {
    const onSuccess = jest.fn();
    const onFail = jest.fn();
    const onCancel = jest.fn();
    const onSettleResult = jest.fn();
    const onBeforeNavigate = jest.fn();

    const { result } = renderHook(() =>
      useHook({ networkId: 'evm--1', accountId: 'hd-1--m/44' }),
    );

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current({
        amount: '1',
        provider: 'aave',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
        onBeforeNavigate,
        onSettleResult,
        onSuccess,
        onFail,
        onCancel,
      });
    });

    expect(started).toBe(false);
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    for (const callback of [
      onSuccess,
      onFail,
      onCancel,
      onSettleResult,
      onBeforeNavigate,
    ]) {
      expect(callback).not.toHaveBeenCalled();
    }
  });
});
