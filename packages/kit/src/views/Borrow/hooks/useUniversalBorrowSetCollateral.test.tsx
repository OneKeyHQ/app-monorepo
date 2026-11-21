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

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

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
    getBorrowTransactionConfirmation: jest.fn(),
  };
  const serviceAccount = { getAccountAddressForApi: jest.fn() };
  (globalThis as Record<string, unknown>).__setCollateralBackgroundMock = {
    serviceStaking,
    serviceAccount,
  };
  return {
    __esModule: true,
    default: { serviceStaking, serviceAccount },
  };
});

jest.mock(
  '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult',
  () => ({
    __esModule: true,
    showDeFiActionTxConfirmDialog: jest.fn(),
  }),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';

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
    getBorrowTransactionConfirmation: jest.Mock;
  };
  serviceAccount: { getAccountAddressForApi: jest.Mock };
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
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockReset();
    backgroundMock.serviceAccount.getAccountAddressForApi.mockReset();
    backgroundMock.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      '0xOwner',
    );

    signatureConfirmMock.navigationToTxConfirm.mockResolvedValue(undefined);
    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue(undefined);
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockResolvedValue(
      {
        canBeCollateral: true,
        liquidationRisk: false,
      },
    );
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

  it('does not check or build if the account changes while resolving the missing owner address', async () => {
    const pending = createDeferred<string>();
    backgroundMock.serviceAccount.getAccountAddressForApi.mockReturnValueOnce(
      pending.promise,
    );
    const view = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalBorrowSetCollateral({ networkId: 'evm--1', accountId }),
      { initialProps: { accountId: 'account-a' } },
    );
    const request = view.result.current({
      ...baseParams,
      useAsCollateral: false,
    });
    await waitFor(() =>
      expect(
        backgroundMock.serviceAccount.getAccountAddressForApi,
      ).toHaveBeenCalledTimes(1),
    );
    view.rerender({ accountId: 'account-b' });
    await act(async () => {
      pending.resolve('0xOwner');
      await request;
    });
    await expect(request).resolves.toBe(false);
    expect(
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
    ).not.toHaveBeenCalled();
  });

  it('does not check or build if the missing owner address cannot be resolved', async () => {
    backgroundMock.serviceAccount.getAccountAddressForApi.mockResolvedValueOnce(
      '',
    );
    const { result } = renderSetCollateral();
    await expect(
      result.current({ ...baseParams, useAsCollateral: false }),
    ).rejects.toThrow('Missing task account address');
    expect(
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
    ).not.toHaveBeenCalled();
  });

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
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mock
        .calls[0][0],
    ).toStrictEqual({
      networkId: 'evm--1',
      accountId: 'account-1',
      expectedAccountAddress: '0xOwner',
      ...baseParams,
      action: 'setCollateral',
      amount: '0',
      useAsCollateral: true,
      eModeId: 0,
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction.mock
        .calls[0][0],
    ).toStrictEqual({
      networkId: 'evm--1',
      accountId: 'account-1',
      expectedAccountAddress: '0xOwner',
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
        onFail: expect.any(Function),
        onCancel: expect.any(Function),
      }),
    );
    const error = new Error('confirmation failed');
    const confirmation = signatureConfirmMock.navigationToTxConfirm.mock
      .calls[0][0] as { onFail: (error: Error) => void };
    confirmation.onFail(error);
    expect(onFail).toHaveBeenCalledWith(error);
  });

  it('calls onCancel when the risk disclaimer is declined without starting a preflight', async () => {
    mockEnsureRiskAccepted.mockResolvedValueOnce(false);
    const onCancel = jest.fn();
    const { result } = renderSetCollateral();
    await expect(
      result.current({ ...baseParams, useAsCollateral: true, onCancel }),
    ).resolves.toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation,
    ).not.toHaveBeenCalled();
  });

  it('forwards confirmation cancellation while preserving the handoff return', async () => {
    signatureConfirmMock.navigationToTxConfirm.mockImplementationOnce(
      async ({ onCancel }: { onCancel: () => void }) => onCancel(),
    );
    const onCancel = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderSetCollateral();
    await expect(
      result.current({
        ...baseParams,
        useAsCollateral: true,
        onCancel,
        onSuccess,
      }),
    ).resolves.toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(backgroundMock.serviceStaking.addEarnOrder).not.toHaveBeenCalled();
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
    const confirmationParams =
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mock
        .calls[0][0];
    expect(confirmationParams).not.toHaveProperty('eModeId');
    expect(buildParams).toStrictEqual({
      networkId: 'evm--1',
      accountId: 'account-1',
      expectedAccountAddress: '0xOwner',
      ...baseParams,
      useAsCollateral: false,
    });
    expect(buildParams).not.toHaveProperty('eModeId');
  });

  it('revalidates immediately before building the transaction', async () => {
    const { result } = renderSetCollateral();

    await act(async () => {
      await result.current({
        ...baseParams,
        useAsCollateral: true,
        stakingInfo,
      });
    });

    expect(
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction.mock
        .invocationCallOrder[0],
    );
  });

  it.each([
    [
      'account',
      { accountId: 'account-b', networkId: 'evm--1', ownerScope: 'reserve-a' },
    ],
    [
      'network',
      {
        accountId: 'account-a',
        networkId: 'evm--137',
        ownerScope: 'reserve-a',
      },
    ],
    [
      'reserve',
      { accountId: 'account-a', networkId: 'evm--1', ownerScope: 'reserve-b' },
    ],
  ])(
    'does not build after the %s changes during final confirmation',
    async (_changed, nextScope) => {
      const pending = createDeferred<{
        canBeCollateral: boolean;
        liquidationRisk: boolean;
      }>();
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockReturnValueOnce(
        pending.promise,
      );
      const { result, rerender } = renderHook(
        (scope: { accountId: string; networkId: string; ownerScope: string }) =>
          useUniversalBorrowSetCollateral(scope),
        {
          initialProps: {
            accountId: 'account-a',
            networkId: 'evm--1',
            ownerScope: 'reserve-a',
          },
        },
      );
      let operation!: Promise<boolean>;
      act(() => {
        operation = result.current({ ...baseParams, useAsCollateral: true });
      });
      await waitFor(() =>
        expect(
          backgroundMock.serviceStaking.getBorrowTransactionConfirmation,
        ).toHaveBeenCalledTimes(1),
      );
      rerender(nextScope);
      await act(async () => {
        pending.resolve({ canBeCollateral: true, liquidationRisk: false });
        await operation;
      });
      expect(
        backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
      ).not.toHaveBeenCalled();
      expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the authoritative confirmation is unavailable', async () => {
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockRejectedValue(
      new Error('confirmation unavailable'),
    );
    const { result } = renderSetCollateral();

    await act(async () => {
      await expect(
        result.current({
          ...baseParams,
          useAsCollateral: false,
          stakingInfo,
        }),
      ).rejects.toThrow('confirmation unavailable');
    });

    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
    ).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
  });

  it('rechecks the backend address before building even when the account id is unchanged', async () => {
    backgroundMock.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      '0xnew',
    );
    const { result } = renderHook(() =>
      useUniversalBorrowSetCollateral({
        networkId: 'evm--1',
        accountId: 'account-a',
        accountAddress: '0xold',
      }),
    );
    await expect(
      result.current({ ...baseParams, useAsCollateral: true }),
    ).rejects.toThrow('Borrow transaction confirmation expired');
    expect(
      backgroundMock.serviceAccount.getAccountAddressForApi,
    ).toHaveBeenCalledWith({ accountId: 'account-a', networkId: 'evm--1' });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
    ).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
  });

  it('blocks a collateral transition with liquidation risk', async () => {
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockResolvedValue(
      {
        liquidationRisk: true,
      },
    );
    const { result } = renderSetCollateral();

    await act(async () => {
      await expect(
        result.current({
          ...baseParams,
          useAsCollateral: false,
          stakingInfo,
        }),
      ).rejects.toThrow('defi_disable_collateral_liquidation_risk__desc');
    });

    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
    ).not.toHaveBeenCalled();
  });

  it('blocks enablement when collateral is explicitly unavailable', async () => {
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockResolvedValue(
      {
        canBeCollateral: false,
        liquidationRisk: false,
      },
    );
    const { result } = renderSetCollateral();

    await act(async () => {
      await expect(
        result.current({
          ...baseParams,
          useAsCollateral: true,
          stakingInfo,
        }),
      ).rejects.toThrow('defi_action_unavailable__msg');
    });

    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
    ).not.toHaveBeenCalled();
  });

  it('allows disablement when canBeCollateral is false', async () => {
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockResolvedValue(
      {
        canBeCollateral: false,
        liquidationRisk: false,
      },
    );
    const { result } = renderSetCollateral();

    await act(async () => {
      await result.current({
        ...baseParams,
        useAsCollateral: false,
        stakingInfo,
      });
    });

    expect(
      backgroundMock.serviceStaking.borrowBuildSetCollateralTransaction,
    ).toHaveBeenCalledTimes(1);
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
        // true = handed off to the tx confirm page (OK-59196 contract); order
        // tracking failing afterwards must not change that.
      ).resolves.toBe(true);
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
