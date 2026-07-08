/* eslint-disable import/first */
import React from 'react';

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Dialog: {
    show: jest.fn(),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult',
  () => {
    const ReactActual = jest.requireActual<typeof React>('react');
    return {
      __esModule: true,
      default: jest.fn(() => ReactActual.createElement(ReactActual.Fragment)),
    };
  },
);

jest.mock('../../utils/waitForTxFinalStatus', () => ({
  __esModule: true,
  waitForTxFinalStatus: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const refreshAccountDeFiPositionsAfterAction = jest.fn();
  return {
    __esModule: true,
    default: {
      serviceDeFi: {
        refreshAccountDeFiPositionsAfterAction,
      },
    },
    mockRefreshAccountDeFiPositionsAfterAction:
      refreshAccountDeFiPositionsAfterAction,
  };
});

import { act, render, waitFor } from '@testing-library/react-native';

import { Dialog } from '@onekeyhq/components';
import PreSwapConfirmResult from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { ESwapStepStatus } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { waitForTxFinalStatus } from '../../utils/waitForTxFinalStatus';

import { showDeFiActionTxConfirmDialog } from './DeFiActionTxConfirmResult';

import type { IDeFiActionTxConfirmDialogResult } from './DeFiActionTxConfirmResult';

const mockDialogShow = Dialog.show as jest.Mock;
const mockPreSwapConfirmResult = PreSwapConfirmResult as jest.Mock;
const mockWaitForTxFinalStatus = waitForTxFinalStatus as jest.Mock;
const mockBackgroundApiProxy = jest.requireMock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
) as {
  mockRefreshAccountDeFiPositionsAfterAction: jest.Mock;
};
const { mockRefreshAccountDeFiPositionsAfterAction } = mockBackgroundApiProxy;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function makeSendSuccessData(txid = '0xtx'): ISendTxOnSuccessData[] {
  return [{ signedTx: { txid } } as unknown as ISendTxOnSuccessData];
}

function renderLatestDialog() {
  const [{ renderContent }] = mockDialogShow.mock.calls[0];
  return render(renderContent);
}

function getLatestPreSwapConfirmResultProps() {
  const calls = mockPreSwapConfirmResult.mock.calls;
  return calls[calls.length - 1][0] as {
    lastStep: { status: ESwapStepStatus; txHash: string };
    onConfirm: () => void;
    confirmButtonTextId?: ETranslations;
  };
}

describe('showDeFiActionTxConfirmDialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockDialogShow.mockReturnValue({ close: jest.fn() });
    mockRefreshAccountDeFiPositionsAfterAction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows success and waits for the user to close the result sheet', async () => {
    mockWaitForTxFinalStatus.mockResolvedValueOnce(
      EOnChainHistoryTxStatus.Success,
    );

    const resultPromise = showDeFiActionTxConfirmDialog({
      accountId: 'acc-1',
      networkId: 'evm--1',
      data: makeSendSuccessData(),
    });

    renderLatestDialog();

    await waitFor(() => {
      expect(mockPreSwapConfirmResult).toHaveBeenLastCalledWith(
        expect.objectContaining({
          lastStep: expect.objectContaining({
            status: ESwapStepStatus.SUCCESS,
            txHash: '0xtx',
          }),
        }),
        undefined,
      );
    });

    let resolvedResult: IDeFiActionTxConfirmDialogResult | 'pending' =
      'pending';
    void resultPromise.then((result) => {
      resolvedResult = result;
    });
    await flushMicrotasks();
    expect(resolvedResult).toBe(EOnChainHistoryTxStatus.Success);
    expect(mockDialogShow.mock.results[0].value.close).not.toHaveBeenCalled();

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await expect(resultPromise).resolves.toBe(EOnChainHistoryTxStatus.Success);
    expect(mockDialogShow.mock.results[0].value.close).not.toHaveBeenCalled();

    act(() => {
      getLatestPreSwapConfirmResultProps().onConfirm();
    });

    expect(mockDialogShow.mock.results[0].value.close).toHaveBeenCalledTimes(1);
  });

  it('resolves the UI caller when pending sheet is dismissed and refreshes after later success', async () => {
    const txStatus = createDeferred<IDeFiActionTxConfirmDialogResult>();
    mockWaitForTxFinalStatus.mockReturnValueOnce(txStatus.promise);

    const resultPromise = showDeFiActionTxConfirmDialog({
      accountId: 'acc-1',
      networkId: 'evm--1',
      data: makeSendSuccessData(),
    });

    renderLatestDialog();

    await waitFor(() => {
      expect(getLatestPreSwapConfirmResultProps().lastStep.status).toBe(
        ESwapStepStatus.PENDING,
      );
    });

    act(() => {
      getLatestPreSwapConfirmResultProps().onConfirm();
    });

    expect(mockDialogShow.mock.results[0].value.close).toHaveBeenCalledTimes(1);

    await expect(resultPromise).resolves.toBeUndefined();
    expect(mockRefreshAccountDeFiPositionsAfterAction).not.toHaveBeenCalled();

    await act(async () => {
      txStatus.resolve(EOnChainHistoryTxStatus.Success);
    });

    await waitFor(() => {
      expect(mockRefreshAccountDeFiPositionsAfterAction).toHaveBeenCalledWith({
        accountId: 'acc-1',
        networkId: 'evm--1',
      });
    });
  });

  it('does not auto-close failed result sheet', async () => {
    mockWaitForTxFinalStatus.mockResolvedValueOnce(
      EOnChainHistoryTxStatus.Failed,
    );

    const resultPromise = showDeFiActionTxConfirmDialog({
      accountId: 'acc-1',
      networkId: 'evm--1',
      data: makeSendSuccessData(),
    });

    renderLatestDialog();

    await waitFor(() => {
      expect(getLatestPreSwapConfirmResultProps()).toEqual(
        expect.objectContaining({
          confirmButtonTextId: ETranslations.global_done,
          lastStep: expect.objectContaining({
            status: ESwapStepStatus.FAILED,
          }),
        }),
      );
    });

    let resolvedResult: IDeFiActionTxConfirmDialogResult | 'pending' =
      'pending';
    void resultPromise.then((result) => {
      resolvedResult = result;
    });
    await flushMicrotasks();
    expect(resolvedResult).toBe(EOnChainHistoryTxStatus.Failed);
    expect(mockDialogShow.mock.results[0].value.close).not.toHaveBeenCalled();

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(mockDialogShow.mock.results[0].value.close).not.toHaveBeenCalled();
  });
});
