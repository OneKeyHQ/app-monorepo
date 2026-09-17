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
  (globalThis as Record<string, unknown>).__setEModeSignatureConfirmMock = {
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
    borrowSwitchCheckEMode: jest.fn(),
    borrowBuildSetEModeTransaction: jest.fn(),
  };
  (globalThis as Record<string, unknown>).__setEModeBackgroundMock = {
    serviceStaking,
  };
  return {
    __esModule: true,
    default: { serviceStaking },
  };
});

jest.mock('@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult', () => {
  const showDeFiActionTxConfirmDialog = jest.fn();
  (globalThis as Record<string, unknown>).__setEModeConfirmDialogMock =
    showDeFiActionTxConfirmDialog;
  return {
    __esModule: true,
    showDeFiActionTxConfirmDialog,
  };
});

import { act, renderHook } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EEarnLabels,
  type IBorrowEModeSwitchCheck,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useUniversalBorrowSetEMode } from './useUniversalBorrowHooks';

const signatureConfirmMock = (globalThis as Record<string, unknown>)
  .__setEModeSignatureConfirmMock as {
  navigationToTxConfirm: jest.Mock;
};
const backgroundMock = (globalThis as Record<string, unknown>)
  .__setEModeBackgroundMock as {
  serviceStaking: {
    addEarnOrder: jest.Mock;
    borrowSwitchCheckEMode: jest.Mock;
    borrowBuildSetEModeTransaction: jest.Mock;
  };
};
const confirmDialogMock = (globalThis as Record<string, unknown>)
  .__setEModeConfirmDialogMock as jest.Mock;
const toastErrorMock = jest.mocked(Toast.error);

function createSwitchCheck(
  canSwitch: boolean,
  reasons: string[] = [],
): IBorrowEModeSwitchCheck {
  return {
    canSwitch,
    reasons,
    disableCollateralAssets: [],
    repayAssets: [],
    additionalRepayAssets: [],
    collateral: {},
    debt: {},
    maxLtv: {},
    healthFactor: {},
  };
}

const successData = [
  {
    signedTx: { txid: 'emode-tx-id' },
    decodedTx: { txid: 'emode-tx-id', status: 'Pending' },
  },
] as ISendTxOnSuccessData[];

describe('useUniversalBorrowSetEMode', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    toastErrorMock.mockReset();
    backgroundMock.serviceStaking.addEarnOrder.mockReset();
    backgroundMock.serviceStaking.borrowSwitchCheckEMode.mockReset();
    backgroundMock.serviceStaking.borrowBuildSetEModeTransaction.mockReset();
    confirmDialogMock.mockReset();

    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue(undefined);
    backgroundMock.serviceStaking.borrowSwitchCheckEMode.mockResolvedValue({
      code: 0,
      message: '',
      data: createSwitchCheck(true),
    });
    backgroundMock.serviceStaking.borrowBuildSetEModeTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'emode-order-id',
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

  it.each([
    [EOnChainHistoryTxStatus.Success, true],
    [EOnChainHistoryTxStatus.Failed, false],
    [undefined, false],
  ])(
    'reports success only after final status %s',
    async (finalStatus, shouldSucceed) => {
      confirmDialogMock.mockResolvedValue(finalStatus);
      const onSuccess = jest.fn();
      const { result } = renderHook(() =>
        useUniversalBorrowSetEMode({
          networkId: 'evm--1',
          accountId: 'hd-1--m/44',
        }),
      );

      await act(async () => {
        await result.current({
          provider: 'aave',
          marketAddress: '0xmarket',
          eModeId: 1,
          stakingInfo: {
            label: EEarnLabels.Borrow,
            protocol: 'aave',
            tags: [EEarnLabels.Borrow],
          },
          onSuccess,
        });
      });

      expect(confirmDialogMock).toHaveBeenCalledWith({
        accountId: 'hd-1--m/44',
        networkId: 'evm--1',
        data: successData,
      });
      expect(onSuccess).toHaveBeenCalledTimes(shouldSucceed ? 1 : 0);
    },
  );

  it('lets a caller own final-status settlement without changing the default', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useUniversalBorrowSetEMode({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
        waitForFinalStatus: false,
      }),
    );

    await act(async () => {
      await result.current({
        provider: 'aave',
        marketAddress: '0xmarket',
        eModeId: 1,
        stakingInfo: {
          label: EEarnLabels.Borrow,
          protocol: 'aave',
          tags: [EEarnLabels.Borrow],
        },
        onSuccess,
      });
    });

    expect(confirmDialogMock).not.toHaveBeenCalled();
    expect(backgroundMock.serviceStaking.addEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('reports a broadcast when auxiliary order tracking rejects', async () => {
    const onSuccess = jest.fn();
    backgroundMock.serviceStaking.addEarnOrder.mockRejectedValue(
      new Error('order tracking unavailable'),
    );
    const { result } = renderHook(() =>
      useUniversalBorrowSetEMode({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
        waitForFinalStatus: false,
      }),
    );

    await act(async () => {
      await expect(
        result.current({
          provider: 'aave',
          marketAddress: '0xmarket',
          eModeId: 1,
          ignoreOrderTrackingError: true,
          stakingInfo: {
            label: EEarnLabels.Borrow,
            protocol: 'aave',
            tags: [EEarnLabels.Borrow, 'borrow:aave:setEMode'],
          },
          onSuccess,
        }),
      ).resolves.toEqual(expect.objectContaining({ canSwitch: true }));
    });

    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('runs the authoritative check before build and returns its latest result', async () => {
    const latestCheck = createSwitchCheck(true);
    backgroundMock.serviceStaking.borrowSwitchCheckEMode.mockResolvedValueOnce({
      code: 0,
      message: '',
      data: latestCheck,
    });
    const { result } = renderHook(() =>
      useUniversalBorrowSetEMode({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
        waitForFinalStatus: false,
      }),
    );

    let returnedCheck: IBorrowEModeSwitchCheck | undefined;
    await act(async () => {
      returnedCheck = await result.current({
        provider: 'aave',
        marketAddress: '0xmarket',
        eModeId: 2,
      });
    });

    expect(
      backgroundMock.serviceStaking.borrowSwitchCheckEMode,
    ).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountId: 'hd-1--m/44',
      provider: 'aave',
      marketAddress: '0xmarket',
      targetEModeId: 2,
      autoHandleError: false,
    });
    expect(
      backgroundMock.serviceStaking.borrowSwitchCheckEMode.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      backgroundMock.serviceStaking.borrowBuildSetEModeTransaction.mock
        .invocationCallOrder[0],
    );
    expect(
      backgroundMock.serviceStaking.borrowBuildSetEModeTransaction.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      signatureConfirmMock.navigationToTxConfirm.mock.invocationCallOrder[0],
    );
    expect(returnedCheck).toBe(latestCheck);
  });

  it('returns fresh blockers without building or opening confirmation', async () => {
    const latestCheck = createSwitchCheck(false, ['repay']);
    backgroundMock.serviceStaking.borrowSwitchCheckEMode.mockResolvedValueOnce({
      code: 0,
      message: '',
      data: latestCheck,
    });
    const { result } = renderHook(() =>
      useUniversalBorrowSetEMode({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
      }),
    );

    let returnedCheck: IBorrowEModeSwitchCheck | undefined;
    await act(async () => {
      returnedCheck = await result.current({
        provider: 'aave',
        marketAddress: '0xmarket',
        eModeId: 2,
      });
    });

    expect(returnedCheck).toBe(latestCheck);
    expect(
      backgroundMock.serviceStaking.borrowBuildSetEModeTransaction,
    ).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('surfaces a non-zero check response once and never builds', async () => {
    backgroundMock.serviceStaking.borrowSwitchCheckEMode.mockResolvedValueOnce({
      code: 12_345,
      message: 'Unable to verify E-Mode',
      data: undefined,
    });
    const { result } = renderHook(() =>
      useUniversalBorrowSetEMode({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
      }),
    );

    await act(async () => {
      await expect(
        result.current({
          provider: 'aave',
          marketAddress: '0xmarket',
          eModeId: 2,
        }),
      ).rejects.toThrow('Unable to verify E-Mode');
    });

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith({
      title: 'Unable to verify E-Mode',
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetEModeTransaction,
    ).not.toHaveBeenCalled();
  });

  it('does not duplicate a check error already owned by auto-toast', async () => {
    const error = Object.assign(new Error('Server check failed'), {
      autoToast: true,
    });
    backgroundMock.serviceStaking.borrowSwitchCheckEMode.mockRejectedValueOnce(
      error,
    );
    const { result } = renderHook(() =>
      useUniversalBorrowSetEMode({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
      }),
    );

    await act(async () => {
      await expect(
        result.current({
          provider: 'aave',
          marketAddress: '0xmarket',
          eModeId: 2,
        }),
      ).rejects.toBe(error);
    });

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.borrowBuildSetEModeTransaction,
    ).not.toHaveBeenCalled();
  });

  it('surfaces a request rejection once when no auto-toast owns it', async () => {
    const error = new Error('Network check failed');
    backgroundMock.serviceStaking.borrowSwitchCheckEMode.mockRejectedValueOnce(
      error,
    );
    const { result } = renderHook(() =>
      useUniversalBorrowSetEMode({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44',
      }),
    );

    await act(async () => {
      await expect(
        result.current({
          provider: 'aave',
          marketAddress: '0xmarket',
          eModeId: 2,
        }),
      ).rejects.toBe(error);
    });

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith({
      title: 'Network check failed',
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildSetEModeTransaction,
    ).not.toHaveBeenCalled();
  });
});
