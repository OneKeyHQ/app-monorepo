import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { queryRetainedTaskStatus } from './queryRetainedTaskStatus';
import { createDepositTask, createDepositTaskState } from './state';

const mockAddress = jest.fn<Promise<string>, []>();
const mockReceipt = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const mockHistory = jest.fn<Promise<unknown>, [unknown]>();
const mockAllowance = jest.fn<
  Promise<{ allowanceParsed: string }>,
  [unknown]
>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: () => mockAddress(),
      getAccountXpub: () => Promise.resolve(undefined),
    },
    serviceHistory: {
      getLocalHistoryTxById: (input: unknown) => mockHistory(input),
    },
    serviceStaking: {
      fetchTokenAllowance: (input: unknown) => mockAllowance(input),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (input: unknown) => mockReceipt(input),
}));

function pendingWrap(txid: string) {
  const task = createDepositTask({
    taskId: 'pending',
    identity: {
      accountId: 'account',
      accountAddress: '0xowner',
      networkId: 'evm--1',
      provider: 'etherfi',
      vault: 'vault',
      inputTokenAddress: '',
      depositTokenAddress: 'weth',
      amount: '1',
      spenderAddress: 'spender',
    },
    steps: [
      { id: 'wrap', kind: 'wrap' },
      { id: 'deposit', kind: 'deposit' },
    ],
  });
  const state = createDepositTaskState(task);
  const event = { taskId: task.taskId, stepId: 'wrap', attemptId: 'attempt' };
  state.dispatch({ ...event, type: 'start' });
  state.dispatch({ ...event, type: 'confirmationOpened' });
  state.dispatch({ ...event, type: 'sendStarted' });
  state.dispatch({ ...event, type: 'submitted', txid });
  state.dispatch({ ...event, type: 'cancel' });
  return state;
}

beforeEach(() => {
  mockAddress.mockReset().mockResolvedValue('0xowner');
  mockReceipt.mockReset().mockResolvedValue(EOnChainHistoryTxStatus.Success);
  mockHistory.mockReset();
  mockAllowance.mockReset();
});

it.each([
  [EReplaceTxType.SpeedUp, 'succeeded'],
  [EReplaceTxType.Cancel, 'failed'],
] as const)(
  'reconciles a confirmed %s replacement without sending again',
  async (replacedType, expected) => {
    const state = pendingWrap('wrap-tx');
    mockReceipt.mockImplementation(async (input) => {
      const params = input as { txid: string };
      return params.txid === 'new-tx'
        ? EOnChainHistoryTxStatus.Success
        : undefined;
    });
    mockHistory
      .mockResolvedValueOnce({ replacedNextId: 'replacement' })
      .mockResolvedValueOnce({ decodedTx: { txid: 'new-tx' }, replacedType });
    await queryRetainedTaskStatus({
      state,
      isCurrent: () => true,
      signal: new AbortController().signal,
    });
    expect(state.getTask().steps[0].status.type).toBe(expected);
    expect(state.getTask().steps[1].status.type).toBe(
      expected === 'succeeded' ? 'ready' : 'waiting',
    );
    expect(mockReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'new-tx' }),
    );
  },
);

it('checks the original hash and advances without building another transaction', async () => {
  const state = pendingWrap('wrap-tx');
  await queryRetainedTaskStatus({
    state,
    isCurrent: () => true,
    signal: new AbortController().signal,
  });
  expect(mockReceipt).toHaveBeenCalledWith(
    expect.objectContaining({ txid: 'wrap-tx' }),
  );
  expect(state.getTask().steps[0].status).toEqual({
    type: 'succeeded',
    txid: 'wrap-tx',
  });
  expect(state.getTask().steps[1].status.type).toBe('ready');
  expect(mockAllowance).not.toHaveBeenCalled();
});

it('does not query a different account or a transaction without a hash', async () => {
  const wrongAccount = pendingWrap('wrap-tx');
  mockAddress.mockResolvedValueOnce('other');
  await expect(
    queryRetainedTaskStatus({
      state: wrongAccount,
      isCurrent: () => true,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('Task account changed');
  expect(mockReceipt).not.toHaveBeenCalled();
  const missingHash = pendingWrap('');
  await queryRetainedTaskStatus({
    state: missingHash,
    isCurrent: () => true,
    signal: new AbortController().signal,
  });
  expect(mockReceipt).not.toHaveBeenCalled();
  expect(missingHash.getTask().steps[0].status.type).toBe('unknown');
});
