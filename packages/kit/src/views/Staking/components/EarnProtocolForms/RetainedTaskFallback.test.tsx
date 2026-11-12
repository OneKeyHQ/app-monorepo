/** @jest-environment jsdom */

import { useEffect, useState } from 'react';

import { fireEvent, render, waitFor } from '@testing-library/react';

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import { depositTaskRegistry } from '../../earnDepositTask/registry';
import {
  createDepositTask,
  createDepositTaskState,
  reduceDepositTask,
} from '../../earnDepositTask/state';

import { RetainedTaskFallback } from './RetainedTaskFallback';

const mockAddress = jest.fn<Promise<string>, []>();
const mockReceipt = jest.fn<Promise<EOnChainHistoryTxStatus>, [unknown]>();
const mockToast = jest.fn();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccountAddressForApi: () => mockAddress() },
    serviceStaking: { fetchTokenAllowance: jest.fn() },
  },
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (input: unknown) => mockReceipt(input),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Alert: ({ action }: { action: { onPrimaryPress: () => void } }) => (
    <button onClick={action.onPrimaryPress}>Retry assets</button>
  ),
  Button: ({
    children,
    onPress,
  }: {
    children: import('react').ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  SizableText: ({ children }: { children: import('react').ReactNode }) => (
    <span>{children}</span>
  ),
  Spinner: () => <span>Loading assets</span>,
  Toast: {
    message: (...args: unknown[]) => {
      mockToast(...args);
    },
  },
  YStack: ({ children }: { children: import('react').ReactNode }) => (
    <div>{children}</div>
  ),
}));

const ownerKey = 'fallback-owner';
function makeState() {
  return createDepositTaskState(
    createDepositTask({
      taskId: 'fallback',
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
    }),
  );
}

it('checks a pending wrap while the asset list is unavailable', async () => {
  mockAddress.mockReset().mockResolvedValue('0xowner');
  mockReceipt.mockReset().mockResolvedValue(EOnChainHistoryTxStatus.Success);
  const state = makeState();
  const event = { taskId: 'fallback', stepId: 'wrap', attemptId: 'attempt' };
  state.dispatch({ ...event, type: 'start' });
  state.dispatch({ ...event, type: 'confirmationOpened' });
  state.dispatch({ ...event, type: 'sendStarted' });
  state.dispatch({ ...event, type: 'submitted', txid: 'wrap-tx' });
  state.dispatch({ ...event, type: 'cancel' });
  const token = depositTaskRegistry.reserve(ownerKey, state);
  expect(token).toBeDefined();
  if (!token) return;
  const reservation = token;
  function Harness() {
    const [task, setTask] = useState(state.getTask());
    useEffect(() => {
      const unsubscribe = state.subscribe(() => setTask(state.getTask()));
      return () => {
        unsubscribe();
      };
    }, []);
    return (
      <RetainedTaskFallback
        ownerKey={ownerKey}
        retainedTask={{ state, task, token: reservation }}
        assetsLoading={false}
        onRetryAssets={() => undefined}
      />
    );
  }
  try {
    const view = render(<Harness />);
    fireEvent.click(view.getByText('global.retry'));
    await waitFor(() =>
      expect(state.getTask().steps[0].status.type).toBe('succeeded'),
    );
    expect(mockReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'wrap-tx' }),
    );
    expect(state.getTask().steps[1].status.type).toBe('ready');
    view.unmount();
  } finally {
    depositTaskRegistry.release(ownerKey, token);
  }
});

it.each(['failed', 'localUnavailable'] as const)(
  'retries a %s order recording when assets are unavailable',
  async (status) => {
    mockToast.mockClear();
    mockAddress.mockReset().mockResolvedValue('0xowner');
    let task = createDepositTask({
      taskId: 'fallback-recording',
      identity: makeState().getTask().identity,
      steps: [{ id: 'deposit', kind: 'deposit' }],
    });
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, {
      ...event,
      type: 'submitted',
      txid: 'deposit-tx',
    });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'deposit-tx', status } };
    const state = createDepositTaskState(task);
    const token = depositTaskRegistry.reserve(ownerKey, state);
    expect(token).toBeDefined();
    if (!token) return;
    const retryDetachedRecording = jest.fn(async () => undefined);
    depositTaskRegistry.retainRecordingHandle(ownerKey, token, {
      taskState: state,
      getTask: state.getTask,
      run: jest.fn(),
      retry: jest.fn(),
      retryStatus: jest.fn(),
      cancel: jest.fn(),
      dispose: jest.fn(),
      subscribeRecovery: () => () => undefined,
      retryDetachedRecording,
    });
    try {
      const view = render(
        <RetainedTaskFallback
          ownerKey={ownerKey}
          retainedTask={{ state, task, token }}
          assetsLoading={false}
          onRetryAssets={() => undefined}
        />,
      );
      mockAddress.mockResolvedValueOnce('0xother');
      fireEvent.click(view.getByText('global.retry'));
      await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
      expect(retryDetachedRecording).not.toHaveBeenCalled();
      fireEvent.click(view.getByText('global.retry'));
      await waitFor(() =>
        expect(retryDetachedRecording).toHaveBeenCalledTimes(1),
      );
      view.unmount();
    } finally {
      depositTaskRegistry.release(ownerKey, token);
    }
  },
);

it('reports an account mismatch when finishing a retained recording', async () => {
  mockToast.mockClear();
  mockAddress.mockReset().mockResolvedValue('0xother');
  let task = createDepositTask({
    taskId: 'fallback-finish',
    identity: makeState().getTask().identity,
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });
  const event = {
    taskId: task.taskId,
    stepId: 'deposit',
    attemptId: 'attempt',
  };
  task = reduceDepositTask(task, { ...event, type: 'start' });
  task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
  task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
  task = reduceDepositTask(task, {
    ...event,
    type: 'submitted',
    txid: 'deposit-tx',
  });
  task = reduceDepositTask(task, { ...event, type: 'handoff' });
  task = { ...task, recording: { txid: 'deposit-tx', status: 'succeeded' } };
  const state = createDepositTaskState(task);
  const token = depositTaskRegistry.reserve(ownerKey, state);
  expect(token).toBeDefined();
  if (!token) return;
  const onFinished = jest.fn();
  try {
    const view = render(
      <RetainedTaskFallback
        ownerKey={ownerKey}
        retainedTask={{ state, task, token }}
        assetsLoading={false}
        onRetryAssets={() => undefined}
        onFinished={onFinished}
      />,
    );
    fireEvent.click(view.getByText('global.done'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(onFinished).not.toHaveBeenCalled();
    expect(depositTaskRegistry.find(ownerKey)).toBeDefined();
    view.unmount();
  } finally {
    depositTaskRegistry.release(ownerKey, token);
  }
});

it('warns about unknown remote sync and finishes only after checking the transaction', async () => {
  mockAddress.mockReset().mockResolvedValue('0xowner');
  mockReceipt.mockReset().mockResolvedValue(EOnChainHistoryTxStatus.Success);
  let task = createDepositTask({
    taskId: 'fallback-unknown',
    identity: makeState().getTask().identity,
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });
  const event = {
    taskId: task.taskId,
    stepId: 'deposit',
    attemptId: 'attempt',
  };
  task = reduceDepositTask(task, { ...event, type: 'start' });
  task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
  task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
  task = reduceDepositTask(task, {
    ...event,
    type: 'submitted',
    txid: 'deposit-tx',
  });
  task = reduceDepositTask(task, { ...event, type: 'handoff' });
  task = {
    ...task,
    recording: { txid: 'deposit-tx', status: 'remoteUnknown' },
  };
  const state = createDepositTaskState(task);
  const token = depositTaskRegistry.reserve(ownerKey, state);
  expect(token).toBeDefined();
  if (!token) return;
  const onFinished = jest.fn();
  try {
    const view = render(
      <RetainedTaskFallback
        ownerKey={ownerKey}
        retainedTask={{ state, task, token }}
        assetsLoading={false}
        onRetryAssets={() => undefined}
        onFinished={onFinished}
      />,
    );
    expect(view.getByText(/global.sync_error/)).toBeTruthy();
    fireEvent.click(view.getByText('global.done'));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(onFinished).toHaveBeenCalledWith('remoteUnknown');
    expect(mockReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'deposit-tx', maxAttempts: 1 }),
    );
    expect(depositTaskRegistry.find(ownerKey)).toBeUndefined();
    view.unmount();
  } finally {
    depositTaskRegistry.release(ownerKey, token);
  }
});
