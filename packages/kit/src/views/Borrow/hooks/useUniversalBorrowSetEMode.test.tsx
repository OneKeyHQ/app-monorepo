/* eslint-disable import/first */

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

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
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
    borrowBuildSetEModeTransaction: jest.Mock;
  };
};
const confirmDialogMock = (globalThis as Record<string, unknown>)
  .__setEModeConfirmDialogMock as jest.Mock;

const successData = [
  {
    signedTx: { txid: 'emode-tx-id' },
    decodedTx: { txid: 'emode-tx-id', status: 'Pending' },
  },
] as ISendTxOnSuccessData[];

describe('useUniversalBorrowSetEMode', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    backgroundMock.serviceStaking.addEarnOrder.mockReset();
    backgroundMock.serviceStaking.borrowBuildSetEModeTransaction.mockReset();
    confirmDialogMock.mockReset();

    backgroundMock.serviceStaking.addEarnOrder.mockResolvedValue(undefined);
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
});
