/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();
  (globalThis as Record<string, unknown>).__repaySignatureConfirmMock = {
    navigationToTxConfirm,
  };
  return {
    __esModule: true,
    useSignatureConfirm: () => ({ navigationToTxConfirm }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    addEarnOrder: jest.fn(),
    borrowBuildRepayTransaction: jest.fn(),
  };
  (globalThis as Record<string, unknown>).__repayBackgroundMock = {
    serviceStaking,
  };
  return {
    __esModule: true,
    default: { serviceStaking },
  };
});

jest.mock(
  '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult',
  () => ({
    __esModule: true,
    showDeFiActionTxConfirmDialog: jest.fn(),
  }),
);

import { act, renderHook } from '@testing-library/react-native';

import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useUniversalBorrowRepay } from './useUniversalBorrowWithdrawRepayHooks';

const signatureConfirmMock = (globalThis as Record<string, unknown>)
  .__repaySignatureConfirmMock as {
  navigationToTxConfirm: jest.Mock;
};
const backgroundMock = (globalThis as Record<string, unknown>)
  .__repayBackgroundMock as {
  serviceStaking: {
    addEarnOrder: jest.Mock;
    borrowBuildRepayTransaction: jest.Mock;
  };
};

const successData = [
  {
    signedTx: { txid: 'repay-tx-id' },
    decodedTx: { txid: 'repay-tx-id', status: 'Pending' },
  },
] as ISendTxOnSuccessData[];

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('useUniversalBorrowRepay order tracking', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    backgroundMock.serviceStaking.addEarnOrder.mockReset();
    backgroundMock.serviceStaking.borrowBuildRepayTransaction.mockReset();

    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue(undefined);
    backgroundMock.serviceStaking.borrowBuildRepayTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({ to: '0xpool', data: '0xrepay' }),
        orderId: 'repay-order-id',
      },
    );
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onSuccess,
      }: {
        onSuccess: (data: ISendTxOnSuccessData[]) => void;
      }) => onSuccess(successData),
    );
  });

  it('reports a broadcast without waiting for auxiliary order tracking', async () => {
    const tracking = createDeferred<void>();
    const onSuccess = jest.fn();
    backgroundMock.serviceStaking.addEarnOrder.mockReturnValue(
      tracking.promise,
    );
    const { result } = renderHook(() =>
      useUniversalBorrowRepay({
        networkId: 'evm--1',
        accountId: 'account-1',
      }),
    );

    const submitPromise = result.current({
      amount: '1',
      provider: 'aave',
      marketAddress: '0xmarket',
      reserveAddress: '0xreserve',
      repayAll: true,
      ignoreOrderTrackingError: true,
      stakingInfo: {
        label: EEarnLabels.Borrow,
        protocol: 'Aave',
        tags: [EEarnLabels.Borrow, 'borrow:aave:repay'],
      },
      onSuccess,
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSuccess).toHaveBeenCalledWith(successData);

    tracking.resolve();
    await act(async () => {
      await submitPromise;
    });
  });
});
