import {
  createDepositTask,
  createDepositTaskState,
  isSameDepositTaskIdentity,
  reduceDepositTask,
} from './state';

import type { IDepositTask, IDepositTaskAction } from './state';

const identity = {
  accountId: 'account-1',
  accountAddress: 'owner',
  networkId: 'evm--1',
  provider: 'etherfi',
  vault: 'vault-1',
  inputTokenAddress: 'native',
  depositTokenAddress: 'weth',
  amount: '1',
  spenderAddress: 'spender-1',
};

it('freezes the transaction intent and rejects changes on recovery', () => {
  const intent = {
    symbol: 'eETH',
    outputTokenAddress: '0xAbC',
    depositTokenDecimals: 18,
    term: 7,
    validatorPublicKey: 'validator',
    slippage: 0.5,
  };
  const task = createDepositTask({
    taskId: 'intent',
    identity: { ...identity, intent },
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });
  intent.symbol = 'different';
  expect(task.identity.intent?.symbol).toBe('eETH');
  const equivalent = {
    ...task.identity,
    accountAddress: 'OWNER',
    intent: {
      ...task.identity.intent,
      symbol: 'eETH',
      outputTokenAddress: '0xabc',
      depositTokenDecimals: 18,
    },
  };
  expect(isSameDepositTaskIdentity(task.identity, equivalent)).toBe(true);
  expect(
    isSameDepositTaskIdentity(task.identity, {
      ...equivalent,
      intent: { ...equivalent.intent, depositTokenDecimals: 6 },
    }),
  ).toBe(false);
  expect(
    isSameDepositTaskIdentity(task.identity, {
      ...equivalent,
      intent: { ...equivalent.intent, slippage: 1 },
    }),
  ).toBe(false);
});

function createTask(): IDepositTask {
  return createDepositTask({
    taskId: 'task-1',
    identity,
    steps: [
      { id: 'wrap', kind: 'wrap' },
      { id: 'approve', kind: 'approve' },
      { id: 'deposit', kind: 'deposit' },
    ],
  });
}

function dispatch(
  task: IDepositTask,
  event: IDepositTaskAction & {
    stepId?: string;
    attemptId?: string;
  },
): IDepositTask {
  return reduceDepositTask(task, {
    taskId: 'task-1',
    stepId: event.stepId ?? 'wrap',
    attemptId: event.attemptId ?? 'attempt-1',
    ...event,
  });
}

function createRetryingApprovalWithConfirmedReset(): IDepositTask {
  let task = createDepositTask({
    taskId: 'task-1',
    identity,
    steps: [
      { id: 'reset-original', kind: 'resetApproval' },
      { id: 'approve', kind: 'approve' },
      { id: 'deposit', kind: 'deposit' },
    ],
  });
  for (const event of [
    { type: 'start' },
    { type: 'confirmationOpened' },
    { type: 'sendStarted' },
    { type: 'submitted', txid: 'reset-tx-1' },
    { type: 'confirmed' },
    { type: 'verified' },
  ] as const) {
    task = dispatch(task, { ...event, stepId: 'reset-original' });
  }
  task = dispatch(task, { type: 'start', stepId: 'approve' });
  task = dispatch(task, { type: 'fail', stepId: 'approve' });
  return dispatch(task, {
    type: 'retry',
    stepId: 'approve',
    attemptId: 'attempt-2',
  });
}

function createRetryingDeposit(): IDepositTask {
  let task = createTask();
  for (const [stepId, txid] of [
    ['wrap', 'wrap-tx'],
    ['approve', 'approve-tx'],
  ] as const) {
    for (const event of [
      { type: 'start' },
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
      { type: 'submitted', txid },
      { type: 'confirmed' },
      { type: 'verified' },
    ] as const) {
      task = dispatch(task, { ...event, stepId });
    }
  }
  task = dispatch(task, { type: 'start', stepId: 'deposit' });
  task = dispatch(task, { type: 'fail', stepId: 'deposit' });
  return dispatch(task, {
    type: 'retry',
    stepId: 'deposit',
    attemptId: 'attempt-2',
  });
}

describe('Earn deposit task state', () => {
  it.each([false, true])(
    'inserts a renewed approval before a retried deposit (reset: %s)',
    (needsReset) => {
      const task = createRetryingDeposit();
      const updated = dispatch(task, {
        type: 'insertApproval',
        stepId: 'deposit',
        attemptId: 'attempt-2',
        approvalStepId: 'approve-new',
        ...(needsReset ? { resetStepId: 'reset-new' } : {}),
      });

      expect(updated.currentStepIndex).toBe(2);
      expect(updated.steps).toEqual([
        {
          id: 'wrap',
          kind: 'wrap',
          attemptId: 'attempt-1',
          status: { type: 'succeeded', txid: 'wrap-tx' },
        },
        {
          id: 'approve',
          kind: 'approve',
          attemptId: 'attempt-1',
          status: { type: 'succeeded', txid: 'approve-tx' },
        },
        ...(needsReset
          ? [
              {
                id: 'reset-new',
                kind: 'resetApproval',
                status: { type: 'ready' },
              },
            ]
          : []),
        {
          id: 'approve-new',
          kind: 'approve',
          status: { type: needsReset ? 'waiting' : 'ready' },
        },
        {
          id: 'deposit',
          kind: 'deposit',
          attemptId: 'attempt-2',
          status: { type: 'waiting' },
        },
      ]);
      expect(task.steps[2].status).toEqual({ type: 'preparing' });
      expect(new Set(updated.steps.map((step) => step.id)).size).toBe(
        updated.steps.length,
      );
    },
  );

  it.each([
    { approvalStepId: '' },
    { approvalStepId: 'wrap' },
    { approvalStepId: 'approve' },
    { approvalStepId: 'deposit' },
    { approvalStepId: 'approve-new', resetStepId: '' },
    { approvalStepId: 'approve-new', resetStepId: 'wrap' },
    { approvalStepId: 'approve-new', resetStepId: 'approve' },
    { approvalStepId: 'approve-new', resetStepId: 'deposit' },
    { approvalStepId: 'approve-new', resetStepId: 'approve-new' },
  ])('rejects invalid inserted approval identifiers: %o', (ids) => {
    const task = createRetryingDeposit();
    expect(
      dispatch(task, {
        type: 'insertApproval',
        stepId: 'deposit',
        attemptId: 'attempt-2',
        ...ids,
      }),
    ).toBe(task);
  });

  it('rejects renewed approval insertion from stale attempts or steps', () => {
    const task = createRetryingDeposit();
    expect(
      dispatch(task, {
        type: 'insertApproval',
        stepId: 'deposit',
        attemptId: 'attempt-1',
        approvalStepId: 'approve-new',
      }),
    ).toBe(task);
    expect(
      dispatch(task, {
        type: 'insertApproval',
        stepId: 'approve',
        attemptId: 'attempt-2',
        approvalStepId: 'approve-new',
      }),
    ).toBe(task);
  });

  it('rejects renewed approval insertion on a non-deposit step', () => {
    let task = createTask();
    task = dispatch(task, { type: 'start' });
    expect(
      dispatch(task, { type: 'insertApproval', approvalStepId: 'approve-new' }),
    ).toBe(task);
  });

  it('rejects renewed approval insertion when the deposit outcome is unknown', () => {
    let task = createRetryingDeposit();
    for (const event of [
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
      { type: 'cancel' },
    ] as const) {
      task = dispatch(task, {
        ...event,
        stepId: 'deposit',
        attemptId: 'attempt-2',
      });
    }
    expect(task.steps[2].status.type).toBe('unknown');
    expect(
      dispatch(task, {
        type: 'insertApproval',
        stepId: 'deposit',
        attemptId: 'attempt-2',
        approvalStepId: 'approve-new',
      }),
    ).toBe(task);
  });

  it('rejects renewed approval insertion without a preceding approval plan', () => {
    let task = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [{ id: 'deposit', kind: 'deposit' }],
    });
    task = dispatch(task, { type: 'start', stepId: 'deposit' });
    expect(
      dispatch(task, {
        type: 'insertApproval',
        stepId: 'deposit',
        approvalStepId: 'approve-new',
      }),
    ).toBe(task);
  });

  it('preserves the confirmed reset while inserting a unique new reset before the retried approval', () => {
    const task = createRetryingApprovalWithConfirmedReset();
    const updated = dispatch(task, {
      type: 'insertReset',
      stepId: 'approve',
      attemptId: 'attempt-2',
      resetStepId: 'reset-new',
    });

    expect(updated).not.toBe(task);
    expect(updated.currentStepIndex).toBe(1);
    expect(updated.steps).toEqual([
      {
        id: 'reset-original',
        kind: 'resetApproval',
        attemptId: 'attempt-1',
        status: { type: 'succeeded', txid: 'reset-tx-1' },
      },
      { id: 'reset-new', kind: 'resetApproval', status: { type: 'ready' } },
      {
        id: 'approve',
        kind: 'approve',
        attemptId: 'attempt-2',
        status: { type: 'waiting' },
      },
      { id: 'deposit', kind: 'deposit', status: { type: 'waiting' } },
    ]);
    expect(new Set(updated.steps.map((step) => step.id)).size).toBe(
      updated.steps.length,
    );
    expect(task.steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'reset-tx-1',
    });
  });

  it.each(['', 'reset-original', 'approve', 'deposit'])(
    'rejects insertion of a reset with empty or duplicate id %s',
    (resetStepId) => {
      const task = createRetryingApprovalWithConfirmedReset();
      expect(
        dispatch(task, {
          type: 'insertReset',
          stepId: 'approve',
          attemptId: 'attempt-2',
          resetStepId,
        }),
      ).toBe(task);
    },
  );

  it('rejects insertion from an old attempt or another step', () => {
    const task = createRetryingApprovalWithConfirmedReset();
    expect(
      dispatch(task, {
        type: 'insertReset',
        stepId: 'approve',
        attemptId: 'attempt-1',
        resetStepId: 'reset-new',
      }),
    ).toBe(task);
    expect(
      dispatch(task, {
        type: 'insertReset',
        stepId: 'reset-original',
        attemptId: 'attempt-2',
        resetStepId: 'reset-new',
      }),
    ).toBe(task);
  });

  it('rejects insertion when the plan has no preceding reset', () => {
    let task = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    task = dispatch(task, { type: 'start', stepId: 'approve' });
    expect(
      dispatch(task, {
        type: 'insertReset',
        stepId: 'approve',
        resetStepId: 'reset-new',
      }),
    ).toBe(task);
  });

  it('rejects insertion when the current step is not an approval', () => {
    let task = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [{ id: 'deposit', kind: 'deposit' }],
    });
    task = dispatch(task, { type: 'start', stepId: 'deposit' });
    expect(
      dispatch(task, {
        type: 'insertReset',
        stepId: 'deposit',
        resetStepId: 'reset-new',
      }),
    ).toBe(task);
  });

  it('rejects insertion while the approval transaction outcome is unknown', () => {
    let task = createRetryingApprovalWithConfirmedReset();
    task = dispatch(task, {
      type: 'confirmationOpened',
      stepId: 'approve',
      attemptId: 'attempt-2',
    });
    task = dispatch(task, {
      type: 'sendStarted',
      stepId: 'approve',
      attemptId: 'attempt-2',
    });
    task = dispatch(task, {
      type: 'cancel',
      stepId: 'approve',
      attemptId: 'attempt-2',
    });
    expect(task.steps[1].status.type).toBe('unknown');
    expect(
      dispatch(task, {
        type: 'insertReset',
        stepId: 'approve',
        attemptId: 'attempt-2',
        resetStepId: 'reset-new',
      }),
    ).toBe(task);
  });

  it('advances only after chain confirmation and the step postcondition', () => {
    let task = createTask();
    task = dispatch(task, { type: 'start' });
    task = dispatch(task, { type: 'confirmationOpened' });
    task = dispatch(task, { type: 'sendStarted' });
    task = dispatch(task, { type: 'submitted', txid: 'wrap-tx' });
    expect(task.steps[0].status).toEqual({
      type: 'confirming',
      txid: 'wrap-tx',
    });
    expect(task.currentStepIndex).toBe(0);
    task = dispatch(task, { type: 'confirmed' });
    expect(task.steps[0].status).toEqual({
      type: 'verifying',
      txid: 'wrap-tx',
    });
    expect(task.currentStepIndex).toBe(0);
    task = dispatch(task, { type: 'verified' });
    expect(task.steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'wrap-tx',
    });
    expect(task.currentStepIndex).toBe(1);
    expect(task.steps[1].status).toEqual({ type: 'ready' });
  });

  it('retains unchanged step references when a task event advances', () => {
    const task = createTask();
    const updated = dispatch(task, { type: 'start' });
    expect(updated).not.toBe(task);
    expect(updated.steps[1]).toBe(task.steps[1]);
    expect(updated.steps[2]).toBe(task.steps[2]);
    expect(dispatch(updated, { type: 'confirmed', attemptId: 'stale' })).toBe(
      updated,
    );
  });

  it('skips a step only while preparing, preserving its explicit skipped status', () => {
    let task = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    task = dispatch(task, { type: 'start', stepId: 'approve' });
    expect(
      dispatch(task, {
        type: 'skip',
        stepId: 'approve',
        attemptId: 'old-attempt',
      }),
    ).toBe(task);
    task = dispatch(task, { type: 'skip', stepId: 'approve' });
    expect(task.steps[0].status).toEqual({ type: 'skipped' });
    expect(task.steps[1].status).toEqual({ type: 'ready' });
    expect(task.currentStepIndex).toBe(1);
  });

  it('ignores callbacks from another task, step, attempt, or illegal transition', () => {
    let task = createTask();
    const stale = reduceDepositTask(task, {
      taskId: 'old-task',
      stepId: 'wrap',
      attemptId: 'attempt-1',
      type: 'start',
    });
    expect(stale).toBe(task);
    task = dispatch(task, { type: 'start' });
    expect(dispatch(task, { type: 'submitted', txid: 'unexpected' })).toBe(
      task,
    );
    expect(
      dispatch(task, { type: 'confirmationOpened', attemptId: 'old-attempt' }),
    ).toBe(task);
    expect(
      dispatch(task, { type: 'confirmationOpened', stepId: 'approve' }),
    ).toBe(task);
  });

  it('treats cancellation after sending as unknown and only permits checking the same transaction', () => {
    let task = createTask();
    task = dispatch(task, { type: 'start' });
    task = dispatch(task, { type: 'confirmationOpened' });
    task = dispatch(task, { type: 'sendStarted' });
    task = dispatch(task, { type: 'submitted', txid: 'wrap-tx' });
    task = dispatch(task, { type: 'cancel' });
    expect(task.steps[0].status).toEqual({
      type: 'unknown',
      txid: 'wrap-tx',
      chainConfirmed: false,
    });
    expect(dispatch(task, { type: 'start', attemptId: 'attempt-2' })).toBe(
      task,
    );
    task = dispatch(task, { type: 'retryStatus' });
    expect(task.steps[0].status).toEqual({
      type: 'confirming',
      txid: 'wrap-tx',
    });
  });

  it('keeps an unknown send without a transaction id blocked', () => {
    let task = createTask();
    task = dispatch(task, { type: 'start' });
    task = dispatch(task, { type: 'confirmationOpened' });
    task = dispatch(task, { type: 'sendStarted' });
    task = dispatch(task, { type: 'cancel' });
    expect(task.steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
    expect(dispatch(task, { type: 'retryStatus' })).toBe(task);
    expect(dispatch(task, { type: 'start', attemptId: 'attempt-2' })).toBe(
      task,
    );
  });

  it('accepts a pre-send rejection only for the matching attempt without a transaction id', () => {
    let task = createTask();
    task = dispatch(task, { type: 'start' });
    task = dispatch(task, { type: 'confirmationOpened' });
    task = dispatch(task, { type: 'sendStarted' });
    expect(dispatch(task, { type: 'sendBlocked', attemptId: 'old' })).toBe(
      task,
    );
    const blocked = dispatch(task, { type: 'sendBlocked' });
    expect(blocked.steps[0].status).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });
    task = dispatch(task, { type: 'submitted', txid: 'wrap-tx' });
    expect(dispatch(task, { type: 'sendBlocked' })).toBe(task);
    task = dispatch(task, { type: 'cancel' });
    expect(dispatch(task, { type: 'sendBlocked' })).toBe(task);
  });

  it('distinguishes an interrupted postcondition from an unconfirmed chain transaction', () => {
    let task = createTask();
    for (const event of [
      { type: 'start' },
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
      { type: 'submitted', txid: 'wrap-tx' },
      { type: 'confirmed' },
      { type: 'cancel' },
    ] as const)
      task = dispatch(task, event);
    expect(task.steps[0].status).toEqual({
      type: 'unknown',
      txid: 'wrap-tx',
      chainConfirmed: true,
    });
    task = dispatch(task, { type: 'retryStatus' });
    expect(task.steps[0].status).toEqual({
      type: 'verifying',
      txid: 'wrap-tx',
    });
  });

  it('never skips wrap or the final deposit', () => {
    let task = createTask();
    task = dispatch(task, { type: 'start' });
    expect(dispatch(task, { type: 'skip' })).toBe(task);
    let deposit = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [{ id: 'deposit', kind: 'deposit' }],
    });
    deposit = dispatch(deposit, { type: 'start', stepId: 'deposit' });
    expect(dispatch(deposit, { type: 'skip', stepId: 'deposit' })).toBe(
      deposit,
    );
  });

  it('accepts a late transaction id from the same uncertain attempt', () => {
    let task = createTask();
    task = dispatch(task, { type: 'start' });
    task = dispatch(task, { type: 'confirmationOpened' });
    task = dispatch(task, { type: 'sendStarted' });
    task = dispatch(task, { type: 'cancel' });
    expect(
      dispatch(task, { type: 'submitted', txid: 'stale', attemptId: 'old' }),
    ).toBe(task);
    task = dispatch(task, { type: 'submitted', txid: 'late-tx' });
    expect(task.steps[0].status).toEqual({
      type: 'unknown',
      txid: 'late-tx',
      chainConfirmed: false,
    });
    expect(dispatch(task, { type: 'submitted', txid: 'different' })).toBe(task);
  });

  it('continues a late deposit submission without changing its published step shape', () => {
    let task = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [{ id: 'deposit', kind: 'deposit' }],
    });
    for (const action of [
      { type: 'start' },
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
      { type: 'cancel' },
      { type: 'submitted', txid: 'late-deposit' },
    ] as const) {
      task = dispatch(task, { ...action, stepId: 'deposit' });
    }
    expect(task.steps[0]).toEqual({
      id: 'deposit',
      kind: 'deposit',
      attemptId: 'attempt-1',
      status: { type: 'confirming', txid: 'late-deposit' },
    });
    task = dispatch(task, { type: 'handoff', stepId: 'deposit' });
    expect(task.steps[0].status).toEqual({
      type: 'handedOff',
      txid: 'late-deposit',
    });
  });

  it('retries a cancelled approval without repeating a completed wrap', () => {
    let task = createTask();
    for (const event of [
      { type: 'start' },
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
      { type: 'submitted', txid: 'wrap-tx' },
      { type: 'confirmed' },
      { type: 'verified' },
    ] as const)
      task = dispatch(task, event);
    task = dispatch(task, { type: 'start', stepId: 'approve' });
    task = dispatch(task, { type: 'cancel', stepId: 'approve' });
    expect(dispatch(task, { type: 'retry', stepId: 'approve' })).toBe(task);
    task = dispatch(task, {
      type: 'retry',
      stepId: 'approve',
      attemptId: 'attempt-2',
    });
    expect(task.steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'wrap-tx',
    });
    expect(task.steps[1].status).toEqual({ type: 'preparing' });
    expect(task.currentStepIndex).toBe(1);
  });

  it('retains the failed transaction id and requires a new attempt to retry', () => {
    let task = createTask();
    for (const event of [
      { type: 'start' },
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
      { type: 'submitted', txid: 'wrap-tx' },
      { type: 'chainFailed' },
    ] as const)
      task = dispatch(task, event);
    expect(task.steps[0].status).toEqual({
      type: 'failed',
      stage: 'onChain',
      txid: 'wrap-tx',
    });
    expect(dispatch(task, { type: 'retry' })).toBe(task);
    expect(
      dispatch(task, { type: 'retry', attemptId: 'attempt-2' }).steps[0].status,
    ).toEqual({ type: 'preparing' });
  });

  it('hands off a submitted deposit without claiming chain confirmation', () => {
    let task = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [{ id: 'deposit', kind: 'deposit' }],
    });
    for (const event of [
      { type: 'start' },
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
      { type: 'submitted', txid: 'deposit-tx' },
      { type: 'handoff' },
    ] as const)
      task = dispatch(task, { ...event, stepId: 'deposit' });
    expect(task.steps[0].status).toEqual({
      type: 'handedOff',
      txid: 'deposit-tx',
    });
    expect(task.currentStepIndex).toBe(1);
  });

  it('rejects plans without one final deposit or with reset after approval', () => {
    expect(() =>
      createDepositTask({
        taskId: 'task-1',
        identity,
        steps: [{ id: 'wrap', kind: 'wrap' }],
      }),
    ).toThrow();
    expect(() =>
      createDepositTask({
        taskId: 'task-1',
        identity,
        steps: [
          { id: 'deposit', kind: 'deposit' },
          { id: 'approve', kind: 'approve' },
        ],
      }),
    ).toThrow();
    expect(() =>
      createDepositTask({
        taskId: 'task-1',
        identity,
        steps: [
          { id: 'approve', kind: 'approve' },
          { id: 'reset', kind: 'resetApproval' },
          { id: 'deposit', kind: 'deposit' },
        ],
      }),
    ).toThrow();
  });

  it('allows distinct approval steps without losing their identities', () => {
    const task = createDepositTask({
      taskId: 'task-1',
      identity,
      steps: [
        { id: 'approve-input', kind: 'approve' },
        { id: 'approve-output', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    expect(task.steps.map((step) => step.id)).toEqual([
      'approve-input',
      'approve-output',
      'deposit',
    ]);
  });

  it('rejects duplicate step identifiers', () => {
    expect(() =>
      createDepositTask({
        taskId: 'task-1',
        identity,
        steps: [
          { id: 'x', kind: 'wrap' },
          { id: 'x', kind: 'approve' },
        ],
      }),
    ).toThrow();
  });
});

it('accepts recording updates only from the bound deposit attempt and owner', () => {
  let task = createDepositTask({
    taskId: 'task-1',
    identity,
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
  task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
  task = reduceDepositTask(task, { ...event, type: 'handoff' });
  const state = createDepositTaskState(task);
  const listener = jest.fn();
  const owner = Symbol('recording');
  const otherOwner = Symbol('other recording');
  const pending = { txid: 'tx', status: 'pending' as const };
  state.subscribe(listener);
  const reentrantUpdate = jest.fn(() =>
    state.setRecording(otherOwner, event, {
      txid: 'tx',
      status: 'succeeded',
    }),
  );
  state.subscribe(reentrantUpdate);

  expect(
    state.setRecording(owner, { ...event, attemptId: 'old' }, pending),
  ).toBe(false);
  expect(state.setRecording(owner, event, { ...pending, txid: 'other' })).toBe(
    false,
  );
  expect(listener).not.toHaveBeenCalled();
  expect(state.setRecording(owner, event, pending)).toBe(true);
  expect(state.setRecording(owner, event, pending)).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(reentrantUpdate).toHaveReturnedWith(false);
  expect(
    state.setRecording(Symbol('other'), event, {
      txid: 'tx',
      status: 'succeeded',
    }),
  ).toBe(false);
  expect(state.getTask().recording).toEqual(pending);
  expect(
    state.setRecording(owner, event, { txid: 'tx', status: 'succeeded' }),
  ).toBe(true);
  expect(state.getTask().recording?.status).toBe('succeeded');
  expect(listener).toHaveBeenCalledTimes(2);
});

it('allows the original owner to record a late accepted deposit without handing off', () => {
  let task = createDepositTask({
    taskId: 'task-1',
    identity,
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });
  const event = {
    taskId: task.taskId,
    stepId: 'deposit',
    attemptId: 'attempt',
  };
  task = reduceDepositTask(task, { ...event, type: 'start' });
  task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
  task = reduceDepositTask(task, { ...event, type: 'outcomeUnknown' });
  task = reduceDepositTask(task, {
    ...event,
    type: 'lateBroadcastAccepted',
    txid: 'tx',
  });
  const state = createDepositTaskState(task);
  expect(
    state.setRecording(Symbol('owner'), event, {
      txid: 'tx',
      status: 'pending',
    }),
  ).toBe(true);
  expect(state.getTask().steps[0].status).toEqual({
    type: 'unknown',
    txid: 'tx',
    chainConfirmed: false,
  });
  const before = state.getTask();
  expect(state.dispatch({ ...event, type: 'retryStatus' })).toBe(true);
  expect(state.getTask().recording).toBe(before.recording);
  expect(state.getTask().steps[0].status).toEqual({
    type: 'confirming',
    txid: 'tx',
  });
});

it('publishes a batch only if every transition is valid', () => {
  const task = createDepositTask({
    taskId: 'task-1',
    identity,
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });
  const state = createDepositTaskState(task);
  const event = {
    taskId: task.taskId,
    stepId: 'deposit',
    attemptId: 'attempt',
  };
  state.dispatch({ ...event, type: 'start' });
  state.dispatch({ ...event, type: 'confirmationOpened' });
  state.dispatch({ ...event, type: 'sendStarted' });
  const before = state.getTask();
  const listener = jest.fn();
  state.subscribe(listener);
  expect(
    state.dispatchBatch([
      { ...event, type: 'submitted', txid: 'tx' },
      { ...event, type: 'skip' },
    ]),
  ).toBe(false);
  expect(state.getTask()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
  expect(
    state.dispatchBatch([
      { ...event, type: 'submitted', txid: 'tx' },
      { ...event, type: 'handoff' },
    ]),
  ).toBe(true);
  expect(state.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'tx',
  });
  expect(listener).toHaveBeenCalledTimes(1);
});
