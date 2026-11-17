/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { depositTaskRegistry } from './registry';
import { createDepositTask, createDepositTaskState } from './state';
import { useRetainedDepositTask } from './useRetainedDepositTask';

import type { IDepositRecordingStatus, IDepositTaskState } from './state';

const mockAccountCurrent = jest.fn<Promise<boolean>, [unknown]>();
jest.mock('./taskAccount', () => ({
  isTaskAccountCurrent: (identity: unknown) => mockAccountCurrent(identity),
}));

const owners = ['retained-a', 'retained-b'];

function makeState(
  id: string,
  status?: IDepositRecordingStatus,
  options?: { recordingTxid?: string; noAttempt?: boolean },
) {
  const initial = createDepositTask({
    taskId: id,
    identity: {
      accountId: id,
      accountAddress: `address-${id}`,
      networkId: 'evm--1',
      provider: 'etherfi',
      vault: 'vault',
      inputTokenAddress: 'token',
      depositTokenAddress: 'token',
      amount: '1',
      spenderAddress: 'spender',
    },
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });
  return createDepositTaskState({
    ...initial,
    currentStepIndex: 1,
    steps: [
      {
        ...initial.steps[0],
        attemptId: options?.noAttempt ? undefined : 'attempt',
        status: { type: 'handedOff', txid: 'tx' },
      },
    ],
    ...(status
      ? { recording: { txid: options?.recordingTxid ?? 'tx', status } }
      : {}),
  });
}

function reserve(owner: string, id: string, status: IDepositRecordingStatus) {
  const state = makeState(id, status);
  const token = depositTaskRegistry.reserve(owner, state);
  expect(token).toBeDefined();
  return { state, token };
}

function reserveDetached(owner: string, state: IDepositTaskState) {
  const token = depositTaskRegistry.reserve(owner, state);
  expect(token).toBeDefined();
  if (!token) return;
  const handle = {
    taskState: state,
    getTask: state.getTask,
    isExecutionCurrent: () => false,
    run: jest.fn(async () => undefined),
    retry: jest.fn(async () => undefined),
    retryStatus: jest.fn(async () => undefined),
    cancel: jest.fn(),
    dispose: jest.fn(),
    subscribeRecovery: jest.fn(() => () => undefined),
    retryDetachedRecording: jest.fn(async () => undefined),
  };
  expect(depositTaskRegistry.retainRecordingHandle(owner, token, handle)).toBe(
    true,
  );
  expect(depositTaskRegistry.detach(owner, token, handle)).toBe(true);
}

beforeEach(() => {
  mockAccountCurrent.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  for (const owner of owners) {
    const entry = depositTaskRegistry.find(owner);
    if (entry) depositTaskRegistry.release(owner, entry.token);
  }
});

it('releases a safely recorded handed-off deposit on re-entry so a new deposit can be started', async () => {
  reserve(owners[0], 'old', 'succeeded');
  const onFinished = jest.fn();
  const { result } = renderHook(() =>
    useRetainedDepositTask(owners[0], onFinished),
  );
  await waitFor(() => expect(result.current.status).toBe('none'));
  expect(depositTaskRegistry.find(owners[0])).toBeUndefined();
  await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  expect(
    depositTaskRegistry.reserve(owners[0], makeState('new')),
  ).toBeDefined();
});

it('releases a retained deposit after its pending order recording succeeds', async () => {
  const state = makeState('pending');
  const recordingOwner = Symbol('recording');
  const binding = {
    taskId: 'pending',
    stepId: 'deposit',
    attemptId: 'attempt',
  };
  expect(
    state.setRecording(recordingOwner, binding, {
      txid: 'tx',
      status: 'pending',
    }),
  ).toBe(true);
  expect(depositTaskRegistry.reserve(owners[0], state)).toBeDefined();
  const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(depositTaskRegistry.find(owners[0])).toBeDefined();
  act(() => {
    expect(
      state.setRecording(recordingOwner, binding, {
        txid: 'tx',
        status: 'succeeded',
      }),
    ).toBe(true);
  });
  await waitFor(() => expect(result.current.status).toBe('none'));
  expect(depositTaskRegistry.find(owners[0])).toBeUndefined();
});

it.each([
  'pending',
  'remoteUnknown',
  'failed',
  'localUnavailable',
  'notTracked',
  'superseded',
] as const)('keeps a %s recording available for recovery', async (status) => {
  const entry = reserve(owners[0], status, status);
  const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(depositTaskRegistry.find(owners[0])?.state).toBe(entry.state);
  expect(
    depositTaskRegistry.reserve(owners[0], makeState('new')),
  ).toBeUndefined();
});

it('retains the task when the final account check fails', async () => {
  mockAccountCurrent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const entry = reserve(owners[0], 'account-changed', 'succeeded');
  const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
  await waitFor(() => expect(mockAccountCurrent).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(depositTaskRegistry.find(owners[0])?.state).toBe(entry.state);
});

it.each([{ recordingTxid: 'other-tx' }, { noAttempt: true }])(
  'keeps a completed recording when its transaction binding is invalid: %o',
  async (options) => {
    const state = makeState('invalid-binding', 'succeeded', options);
    expect(depositTaskRegistry.reserve(owners[0], state)).toBeDefined();
    const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(depositTaskRegistry.find(owners[0])?.state).toBe(state);
  },
);

it('does not release a replacement entry while the final account check is pending', async () => {
  let resolveCheck: (value: boolean) => void = () => undefined;
  mockAccountCurrent.mockResolvedValueOnce(true).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveCheck = resolve;
    }),
  );
  const original = reserve(owners[0], 'original', 'succeeded');
  renderHook(() => useRetainedDepositTask(owners[0]));
  await waitFor(() => expect(mockAccountCurrent).toHaveBeenCalledTimes(2));
  const originalToken = original.token;
  if (!originalToken) return;
  act(() => {
    depositTaskRegistry.release(owners[0], originalToken);
    reserve(owners[0], 'replacement', 'pending');
  });
  await act(async () => {
    resolveCheck(true);
  });
  expect(depositTaskRegistry.find(owners[0])?.state.getTask().taskId).toBe(
    'replacement',
  );
});

it('does not release the old owner after the user switches accounts during its final account check', async () => {
  let resolveCheck: (value: boolean) => void = () => undefined;
  mockAccountCurrent.mockResolvedValueOnce(true).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveCheck = resolve;
    }),
  );
  reserve(owners[0], 'original', 'succeeded');
  const onFinished = jest.fn();
  const { rerender } = renderHook(
    ({ owner }) => useRetainedDepositTask(owner, onFinished),
    {
      initialProps: { owner: owners[0] },
    },
  );
  await waitFor(() => expect(mockAccountCurrent).toHaveBeenCalledTimes(2));
  rerender({ owner: owners[1] });
  await act(async () => {
    resolveCheck(true);
  });
  expect(depositTaskRegistry.find(owners[0])?.state.getTask().taskId).toBe(
    'original',
  );
  expect(onFinished).not.toHaveBeenCalled();
});

it('does not release or call the old owner after committed A to B to A switches', async () => {
  let resolveOldCheck: (value: boolean) => void = () => undefined;
  const nextCheck = new Promise<boolean>(() => undefined);
  mockAccountCurrent
    .mockResolvedValueOnce(true)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOldCheck = resolve;
      }),
    )
    .mockReturnValue(nextCheck);
  const entry = reserve(owners[0], 'original', 'succeeded');
  const onFinished = jest.fn();
  const { rerender } = renderHook(
    ({ owner }) => useRetainedDepositTask(owner, onFinished),
    { initialProps: { owner: owners[0] } },
  );
  await waitFor(() => expect(mockAccountCurrent).toHaveBeenCalledTimes(2));
  rerender({ owner: owners[1] });
  rerender({ owner: owners[0] });
  await waitFor(() => expect(mockAccountCurrent).toHaveBeenCalledTimes(3));
  await act(async () => {
    resolveOldCheck(true);
  });
  expect(depositTaskRegistry.find(owners[0])?.state).toBe(entry.state);
  expect(onFinished).not.toHaveBeenCalled();
});

it('keeps a cancelled deposit when a late broadcast is accepted during the final account check', async () => {
  let resolveCheck: (value: boolean) => void = () => undefined;
  mockAccountCurrent.mockResolvedValueOnce(true).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveCheck = resolve;
    }),
  );
  const base = createDepositTask({
    taskId: 'late-cancelled-deposit',
    identity: makeState('late-owner').getTask().identity,
    steps: [
      { id: 'approve', kind: 'approve' },
      { id: 'deposit', kind: 'deposit' },
    ],
  });
  const state = createDepositTaskState({
    ...base,
    currentStepIndex: 1,
    steps: [
      {
        ...base.steps[0],
        attemptId: 'approval-attempt',
        status: { type: 'succeeded', txid: 'approval-tx' },
      },
      {
        ...base.steps[1],
        attemptId: 'deposit-attempt',
        status: { type: 'cancelled' },
      },
    ],
  });
  reserveDetached(owners[0], state);
  const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
  await waitFor(() => expect(mockAccountCurrent).toHaveBeenCalledTimes(2));
  act(() => {
    expect(
      state.dispatch({
        type: 'lateBroadcastAccepted',
        taskId: base.taskId,
        stepId: 'deposit',
        attemptId: 'deposit-attempt',
        txid: 'late-deposit-tx',
      }),
    ).toBe(true);
  });
  await act(async () => resolveCheck(true));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(depositTaskRegistry.find(owners[0])?.state).toBe(state);
  expect(state.getTask().steps[1].status).toEqual({
    type: 'unknown',
    txid: 'late-deposit-tx',
    chainConfirmed: false,
  });
});

function makeCancelledApprovalState() {
  const base = createDepositTask({
    taskId: 'cancelled-approval-after-wrap',
    identity: makeState('cancelled-approval-owner').getTask().identity,
    steps: [
      { id: 'wrap', kind: 'wrap' },
      { id: 'approve', kind: 'approve' },
      { id: 'deposit', kind: 'deposit' },
    ],
  });
  return createDepositTaskState({
    ...base,
    currentStepIndex: 1,
    steps: [
      {
        ...base.steps[0],
        attemptId: 'wrap-attempt',
        status: { type: 'succeeded', txid: 'wrap-tx' },
      },
      {
        ...base.steps[1],
        attemptId: 'approval-attempt',
        status: { type: 'cancelled' },
      },
      { ...base.steps[2], status: { type: 'waiting' } },
    ],
  });
}

it('discards a detached cancelled approval after wrap and permits a fresh task', async () => {
  const state = makeCancelledApprovalState();
  reserveDetached(owners[0], state);
  const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
  await waitFor(() => expect(result.current.status).toBe('none'));
  expect(depositTaskRegistry.find(owners[0])).toBeUndefined();
  const fresh = makeState('fresh-after-cancelled-approval');
  expect(depositTaskRegistry.reserve(owners[0], fresh)).toBeDefined();
  expect(depositTaskRegistry.find(owners[0])?.state).toBe(fresh);
});

it('keeps a cancelled approval if its broadcast arrives during the final account check', async () => {
  let resolveCheck: (value: boolean) => void = () => undefined;
  mockAccountCurrent.mockResolvedValueOnce(true).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveCheck = resolve;
    }),
  );
  const state = makeCancelledApprovalState();
  reserveDetached(owners[0], state);
  const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
  await waitFor(() => expect(mockAccountCurrent).toHaveBeenCalledTimes(2));
  act(() => {
    expect(
      state.dispatch({
        type: 'lateBroadcastAccepted',
        taskId: 'cancelled-approval-after-wrap',
        stepId: 'approve',
        attemptId: 'approval-attempt',
        txid: 'late-approval-tx',
      }),
    ).toBe(true);
  });
  await act(async () => resolveCheck(true));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(state.getTask().steps[1].status).toEqual({
    type: 'unknown',
    txid: 'late-approval-tx',
    chainConfirmed: false,
  });
  expect(depositTaskRegistry.find(owners[0])?.state).toBe(state);
  expect(
    depositTaskRegistry.reserve(owners[0], makeState('fresh-blocked')),
  ).toBeUndefined();
});

it.each([
  { step: 'approve', status: 'sending' },
  { step: 'approve', status: 'unknown' },
  { step: 'deposit', status: 'sending' },
  { step: 'deposit', status: 'unknown' },
] as const)(
  'keeps a detached task when $step broadcast is $status',
  async ({ step, status }) => {
    const base = createDepositTask({
      taskId: `${step}-${status}`,
      identity: makeState('uncertain-owner').getTask().identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const unresolved =
      status === 'sending'
        ? ({ type: 'sending' } as const)
        : ({ type: 'unknown', chainConfirmed: false } as const);
    const state = createDepositTaskState({
      ...base,
      currentStepIndex: step === 'approve' ? 1 : 2,
      steps: [
        {
          ...base.steps[0],
          attemptId: 'wrap-attempt',
          status: { type: 'succeeded', txid: 'wrap-tx' },
        },
        {
          ...base.steps[1],
          attemptId: 'approval-attempt',
          status:
            step === 'approve'
              ? unresolved
              : { type: 'succeeded', txid: 'approval-tx' },
        },
        {
          ...base.steps[2],
          attemptId: step === 'deposit' ? 'deposit-attempt' : undefined,
          status: step === 'deposit' ? unresolved : { type: 'waiting' },
        },
      ],
    });
    reserveDetached(owners[0], state);
    const { result } = renderHook(() => useRetainedDepositTask(owners[0]));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(depositTaskRegistry.find(owners[0])?.state).toBe(state);
    expect(
      depositTaskRegistry.reserve(owners[0], makeState('new')),
    ).toBeUndefined();
  },
);
