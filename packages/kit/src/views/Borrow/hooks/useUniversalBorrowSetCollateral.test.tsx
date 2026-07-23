/* eslint-disable import/first */

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();
  (globalThis as Record<string, unknown>).__setCollateralSignatureConfirmMock =
    {
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
    borrowBuildSetCollateralTransaction: jest.fn(),
  };
  (globalThis as Record<string, unknown>).__setCollateralBackgroundMock = {
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
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useUniversalBorrowSetCollateral } from './useUniversalBorrowHooks';
import { handleBorrowSuccess } from './useUniversalBorrowWithdrawRepayHooks';

const signatureConfirmMock = (globalThis as Record<string, unknown>)
  .__setCollateralSignatureConfirmMock as {
  navigationToTxConfirm: jest.Mock;
};
const backgroundMock = (globalThis as Record<string, unknown>)
  .__setCollateralBackgroundMock as {
  serviceStaking: {
    addEarnOrder: jest.Mock;
    borrowBuildSetCollateralTransaction: jest.Mock;
  };
};

const stakingInfo: IStakingInfo = {
  label: EEarnLabels.Borrow,
  protocol: 'aave',
  tags: [EEarnLabels.Borrow, 'borrow:aave:setCollateral'],
};
const successData = [
  {
    signedTx: { txid: 'set-collateral-tx-id' },
    decodedTx: {
      txid: 'set-collateral-tx-id',
      status: 'Pending',
    },
  },
] as ISendTxOnSuccessData[];

const baseParams = {
  provider: 'aave',
  marketAddress: '0xmarket',
  reserveAddress: '0xreserve',
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('useUniversalBorrowSetCollateral', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    backgroundMock.serviceStaking.addEarnOrder.mockReset();
    backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction.mockReset();

    signatureConfirmMock.navigationToTxConfirm.mockResolvedValue(undefined);
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue(undefined);
    backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({ to: '0xpool', data: '0xenable' }),
        orderId: 'set-collateral-order-id',
      },
    );
  });

  const renderSetCollateral = () =>
    renderHook(() =>
      useUniversalBorrowSetCollateral({
        networkId: 'evm--1',
        accountId: 'account-1',
      }),
    );

  it('preserves eModeId zero in the enable-collateral build payload', async () => {
    const onFail = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderSetCollateral();

    await act(async () => {
      await result.current({
        ...baseParams,
        useAsCollateral: true,
        eModeId: 0,
        stakingInfo,
        onFail,
        onCancel,
      });
    });

    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction.mock
        .calls[0][0],
    ).toStrictEqual({
      networkId: 'evm--1',
      accountId: 'account-1',
      ...baseParams,
      useAsCollateral: true,
      eModeId: 0,
    });
    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: { to: '0xpool', data: '0xenable' },
        stakingInfo: {
          ...stakingInfo,
          orderId: 'set-collateral-order-id',
        },
        onFail,
        onCancel,
      }),
    );
  });

  it('omits eModeId from the disable-collateral build payload', async () => {
    const { result } = renderSetCollateral();

    await act(async () => {
      await result.current({
        ...baseParams,
        useAsCollateral: false,
        eModeId: 7,
        stakingInfo,
      });
    });

    const buildParams =
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction.mock
        .calls[0][0];
    expect(buildParams).toStrictEqual({
      networkId: 'evm--1',
      accountId: 'account-1',
      ...baseParams,
      useAsCollateral: false,
    });
    expect(buildParams).not.toHaveProperty('eModeId');
  });

  it('reports broadcast success even when order tracking fails', async () => {
    const trackingError = new Error('order tracking unavailable');
    const onSuccess = jest.fn();
    backgroundMock.serviceStaking.addEarnOrder.mockRejectedValue(trackingError);
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onSuccess: handleConfirmSuccess,
      }: {
        onSuccess: (data: ISendTxOnSuccessData[]) => Promise<void>;
      }) => handleConfirmSuccess(successData),
    );
    const { result } = renderSetCollateral();

    await act(async () => {
      await expect(
        result.current({
          ...baseParams,
          useAsCollateral: true,
          eModeId: 0,
          stakingInfo,
          onSuccess,
        }),
      ).resolves.toBeUndefined();
    });

    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledWith({
      orderId: 'set-collateral-order-id',
      networkId: 'evm--1',
      txId: 'set-collateral-tx-id',
      status: 'Pending',
      stakingLabel: EEarnLabels.Borrow,
      stakingProtocol: 'aave',
      stakingTags: [EEarnLabels.Borrow, 'borrow:aave:setCollateral'],
    });
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('does not wait for pending order tracking before reporting broadcast success', async () => {
    const tracking = createDeferred<void>();
    const onSuccess = jest.fn();
    backgroundMock.serviceStaking.addEarnOrder.mockReturnValue(
      tracking.promise,
    );
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onSuccess: handleConfirmSuccess,
      }: {
        onSuccess: (data: ISendTxOnSuccessData[]) => Promise<void>;
      }) => handleConfirmSuccess(successData),
    );
    const { result } = renderSetCollateral();

    await act(async () => {
      await result.current({
        ...baseParams,
        useAsCollateral: true,
        eModeId: 0,
        stakingInfo,
        onSuccess,
      });
    });

    expect(onSuccess).toHaveBeenCalledWith(successData);
    tracking.resolve();
    await act(async () => {
      await tracking.promise;
    });
  });

  it('keeps order tracking failures strict for callers that do not opt out', async () => {
    const trackingError = new Error('order tracking unavailable');
    const onSuccess = jest.fn();
    backgroundMock.serviceStaking.addEarnOrder.mockRejectedValue(trackingError);

    await expect(
      handleBorrowSuccess({
        data: successData,
        orderId: 'set-collateral-order-id',
        networkId: 'evm--1',
        accountId: 'account-1',
        stakingInfo,
        onSuccess,
      }),
    ).rejects.toBe(trackingError);

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not open transaction confirmation when the builder rejects', async () => {
    backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction.mockRejectedValue(
      new Error('build failed'),
    );
    const { result } = renderSetCollateral();

    await act(async () => {
      await expect(
        result.current({
          ...baseParams,
          useAsCollateral: true,
          eModeId: 0,
          stakingInfo,
        }),
      ).rejects.toThrow('build failed');
    });

    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    expect(backgroundMock.serviceStaking.addEarnOrder).not.toHaveBeenCalled();
  });
});
