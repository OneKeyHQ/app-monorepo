import { isValidElement } from 'react';

import { render, waitFor } from '@testing-library/react-native';

import { Dialog } from '@onekeyhq/components';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import PreSwapConfirmResult from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { ESwapStepStatus } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { showDeFiActionTxConfirmDialog } from './DeFiActionTxConfirmResult';

jest.mock('@onekeyhq/components', () => ({ Dialog: { show: jest.fn() } }));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps the result pending when the account changes during the history lookup and returns', async () => {
  let actualAddress = '0xOwner';
  jest.mocked(waitForTxFinalStatus).mockImplementationOnce(async (params) => {
    actualAddress = '0xOther';
    const matches = params.expectedAccountAddress === actualAddress;
    actualAddress = '0xOwner';
    return matches ? EOnChainHistoryTxStatus.Success : undefined;
  });
  const show = jest.mocked(Dialog.show);
  const result = showDeFiActionTxConfirmDialog({
    accountId: 'account-id',
    networkId: 'evm--1',
    expectedAccountAddress: '0xOwner',
    data: [{ signedTx: { txid: '0xTx' } }] as ISendTxOnSuccessData[],
  });
  const onResult = jest.fn();
  void result.then(onResult);
  const content = show.mock.calls[0][0].renderContent;
  if (!isValidElement(content))
    throw new OneKeyLocalError('Missing result content');
  const view = render(content);
  await waitFor(() => expect(waitForTxFinalStatus).toHaveBeenCalledTimes(1));
  expect(waitForTxFinalStatus).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xOwner' }),
  );
  expect(actualAddress).toBe('0xOwner');
  expect(onResult).not.toHaveBeenCalled();
  const confirmation = view.UNSAFE_root.findByType(PreSwapConfirmResult);
  expect(confirmation.props.lastStep.status).toBe(ESwapStepStatus.PENDING);
});

it('keeps callers without an expected address compatible', async () => {
  jest
    .mocked(waitForTxFinalStatus)
    .mockResolvedValueOnce(EOnChainHistoryTxStatus.Success);
  const result = showDeFiActionTxConfirmDialog({
    accountId: 'account-id',
    networkId: 'evm--1',
    data: [{ signedTx: { txid: '0xTx' } }] as ISendTxOnSuccessData[],
  });
  const content = jest.mocked(Dialog.show).mock.calls[0][0].renderContent;
  if (!isValidElement(content))
    throw new OneKeyLocalError('Missing result content');
  render(content);

  await expect(result).resolves.toBe(EOnChainHistoryTxStatus.Success);
  expect(waitForTxFinalStatus).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: undefined }),
  );
});
