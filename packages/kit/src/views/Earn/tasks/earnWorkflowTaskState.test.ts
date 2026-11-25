import {
  createEarnWorkflowTask,
  reduceEarnWorkflowTask,
} from './earnWorkflowTaskState';

import type { IEarnWorkflowTaskEvent } from './earnWorkflowTaskState';

const identity = {
  accountId: 'account',
  networkId: 'evm--1',
  provider: 'provider',
  action: 'withdraw',
  intent: { amount: '0', vault: 'vault' },
};

const event = (
  stepId: string,
  attemptId: string,
  payload: IEarnWorkflowTaskEvent['payload'],
): IEarnWorkflowTaskEvent => ({ taskId: 'task', stepId, attemptId, payload });

it('only inserts retry approvals for the current preparing deposit and unique step IDs', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
      { id: 'deposit', kind: 'deposit', lateSubmitted: 'confirming' },
    ],
  });
  task = reduceEarnWorkflowTask(
    task,
    event('approve', 'a1', { kind: 'transaction', action: { type: 'start' } }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('approve', 'a1', { kind: 'transaction', action: { type: 'skip' } }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('deposit', 'd1', { kind: 'transaction', action: { type: 'start' } }),
  );
  const before = task;
  const change = {
    kind: 'planChange',
    change: {
      type: 'insertApproval',
      approvalStepId: 'approve-2',
      resetStepId: 'reset-2',
    },
  } as const;
  expect(
    reduceEarnWorkflowTask(task, event('deposit', 'stale-attempt', change)),
  ).toBe(before);
  expect(
    reduceEarnWorkflowTask(
      task,
      event('deposit', 'd1', {
        kind: 'planChange',
        change: { type: 'insertApproval', approvalStepId: 'approve' },
      }),
    ),
  ).toBe(before);
  task = reduceEarnWorkflowTask(task, event('deposit', 'd1', change));
  expect(task.steps.map((step) => [step.id, step.status.type])).toEqual([
    ['approve', 'skipped'],
    ['reset-2', 'ready'],
    ['approve-2', 'waiting'],
    ['deposit', 'waiting'],
  ]);
  expect(reduceEarnWorkflowTask(task, event('deposit', 'd1', change))).toBe(
    task,
  );
});

it('composes sign, transaction and wait in one ordered task', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'sign', kind: 'sign' },
      { id: 'unstake', kind: 'protocol', lateSubmitted: 'unknown' },
      { id: 'wait', kind: 'wait' },
    ],
  });
  const apply = (e: IEarnWorkflowTaskEvent) => {
    task = reduceEarnWorkflowTask(task, e);
  };
  const initial = task;
  apply(
    event('unstake', 'other', {
      kind: 'transaction',
      action: { type: 'start' },
    }),
  );
  expect(task).toBe(initial);
  apply(event('sign', 's1', { kind: 'sign', action: 'start' }));
  const signed = Object.assign(
    event('sign', 's1', { kind: 'sign', action: 'complete' }),
    { secret: 'signature-must-not-be-stored' },
  );
  apply(signed);
  expect(task.currentStepIndex).toBe(1);
  expect(task.steps[1].status).toEqual({ type: 'ready' });
  expect(JSON.stringify(task)).not.toContain('signature-must-not-be-stored');
  apply(
    event('unstake', 't1', { kind: 'transaction', action: { type: 'start' } }),
  );
  apply(
    event('unstake', 't1', {
      kind: 'transaction',
      action: { type: 'confirmationOpened' },
    }),
  );
  apply(
    event('unstake', 't1', {
      kind: 'transaction',
      action: { type: 'sendStarted' },
    }),
  );
  apply(
    event('unstake', 't1', {
      kind: 'transaction',
      action: { type: 'submitted', txid: 'tx' },
    }),
  );
  apply(
    event('unstake', 't1', {
      kind: 'transaction',
      action: { type: 'handoff' },
    }),
  );
  expect(task.currentStepIndex).toBe(2);
  expect(task.steps[1].status).toEqual({ type: 'handedOff', txid: 'tx' });
  apply(event('wait', 'w1', { kind: 'wait', action: 'start' }));
  apply(event('wait', 'w1', { kind: 'wait', action: 'complete' }));
  expect(task.currentStepIndex).toBe(3);
  expect(task.steps[2].status).toEqual({ type: 'completed' });
});

it('never retries an uncertain external side effect without an explicit not-applied resolution', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'push', kind: 'external' },
      { id: 'wait', kind: 'wait' },
    ],
  });
  const apply = (e: IEarnWorkflowTaskEvent) => {
    task = reduceEarnWorkflowTask(task, e);
  };
  apply(event('push', 'p1', { kind: 'external', action: 'start' }));
  apply(event('push', 'p1', { kind: 'external', action: 'invoke' }));
  apply(event('push', 'p1', { kind: 'external', action: 'fail' }));
  expect(task.steps[0].status).toEqual({ type: 'unknown' });
  const unknown = task;
  apply(event('push', 'p2', { kind: 'external', action: 'retry' }));
  expect(task).toBe(unknown);
  apply(
    event('push', 'p1', { kind: 'external', action: 'resolvedNotApplied' }),
  );
  apply(event('push', 'p2', { kind: 'external', action: 'retry' }));
  apply(event('push', 'p2', { kind: 'external', action: 'invoke' }));
  const active = task;
  apply(event('push', 'p1', { kind: 'external', action: 'accepted' }));
  expect(task).toBe(active);
  const accepted = Object.assign(
    event('push', 'p2', { kind: 'external', action: 'accepted' }),
    { psbt: 'psbt-must-not-be-stored' },
  );
  apply(accepted);
  expect(task.steps[0].status).toEqual({ type: 'completed' });
  expect(task.currentStepIndex).toBe(1);
  expect(JSON.stringify(task)).not.toContain('psbt-must-not-be-stored');
});

it('allows a read-only wait to retry an unknown result with a new attempt', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [{ id: 'wait', kind: 'wait' }],
  });
  const apply = (e: IEarnWorkflowTaskEvent) => {
    task = reduceEarnWorkflowTask(task, e);
  };
  apply(event('wait', 'w1', { kind: 'wait', action: 'start' }));
  apply(event('wait', 'w1', { kind: 'wait', action: 'unknown' }));
  const unknown = task;
  apply(event('wait', 'w1', { kind: 'wait', action: 'retry' }));
  expect(task).toBe(unknown);
  apply(event('wait', 'w2', { kind: 'wait', action: 'retry' }));
  const retry = task;
  apply(event('wait', 'w1', { kind: 'wait', action: 'complete' }));
  expect(task).toBe(retry);
  apply(event('wait', 'w2', { kind: 'wait', action: 'complete' }));
  expect(task.currentStepIndex).toBe(1);
});

it('retries a cancelled signature only with a new attempt and rejects the old callback', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'sign', kind: 'sign' },
      { id: 'tx', kind: 'protocol', lateSubmitted: 'unknown' },
    ],
  });
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's1', { kind: 'sign', action: 'start' }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's1', { kind: 'sign', action: 'cancel' }),
  );
  const cancelled = task;
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's1', { kind: 'sign', action: 'retry' }),
  );
  expect(task).toBe(cancelled);
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's2', { kind: 'sign', action: 'retry' }),
  );
  const retried = task;
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's1', { kind: 'sign', action: 'complete' }),
  );
  expect(task).toBe(retried);
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's2', { kind: 'sign', action: 'complete' }),
  );
  expect(task.currentStepIndex).toBe(1);
});

it('skips an optional signature only for its current attempt', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'sign', kind: 'sign' },
      { id: 'tx', kind: 'protocol', lateSubmitted: 'unknown' },
    ],
  });
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's1', { kind: 'sign', action: 'start' }),
  );
  const running = task;
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 'old', { kind: 'sign', action: 'skip' }),
  );
  expect(task).toBe(running);
  task = reduceEarnWorkflowTask(
    task,
    event('sign', 's1', { kind: 'sign', action: 'skip' }),
  );
  expect(task.steps[0].status.type).toBe('skipped');
  expect(task.currentStepIndex).toBe(1);
});

it('rejects empty and duplicate task step identities', () => {
  expect(() =>
    createEarnWorkflowTask({ taskId: 'task', identity, steps: [] }),
  ).toThrow();
  expect(() =>
    createEarnWorkflowTask({
      taskId: 'task',
      identity,
      steps: [
        { id: 'a', kind: 'sign' },
        { id: 'a', kind: 'wait' },
      ],
    }),
  ).toThrow();
});

it('rejects foreign task, wrong kind, empty attempt and duplicate side-effect events', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [{ id: 'push', kind: 'external' }],
  });
  const initial = task;
  const originalEvent = event('push', 'p1', {
    kind: 'external',
    action: 'start',
  });
  task = reduceEarnWorkflowTask(task, { ...originalEvent, taskId: 'foreign' });
  task = reduceEarnWorkflowTask(
    task,
    event('push', '', { kind: 'external', action: 'start' }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'p1', { kind: 'sign', action: 'start' }),
  );
  expect(task).toBe(initial);
  task = reduceEarnWorkflowTask(task, originalEvent);
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'p1', { kind: 'external', action: 'invoke' }),
  );
  const executing = task;
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'p1', { kind: 'external', action: 'invoke' }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'p2', { kind: 'external', action: 'retry' }),
  );
  expect(task).toBe(executing);
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'p1', { kind: 'external', action: 'cancel' }),
  );
  expect(task.steps[0].status).toEqual({ type: 'unknown' });
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'p1', { kind: 'external', action: 'accepted' }),
  );
  expect(task.steps[0].status).toEqual({ type: 'completed' });
});

it('does not copy execution payloads accidentally attached to a step plan', () => {
  const step = {
    id: 'sign',
    kind: 'sign' as const,
    signature: 'secret-output',
  };
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [step],
  });
  expect(JSON.stringify(task)).not.toContain('secret-output');
});

it('records late external acceptance only for the current attempt without advancing', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'push', kind: 'external' },
      { id: 'next', kind: 'wait' },
    ],
  });
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'attempt', { kind: 'external', action: 'start' }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'attempt', { kind: 'external', action: 'invoke' }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'attempt', { kind: 'external', action: 'cancel' }),
  );
  const unknown = task;
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'old-attempt', {
      kind: 'external',
      action: 'acceptedAfterInvalidation',
    }),
  );
  expect(task).toBe(unknown);
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'attempt', {
      kind: 'external',
      action: 'acceptedAfterInvalidation',
    }),
  );
  expect(task.steps.map(({ status }) => status.type)).toEqual([
    'completed',
    'waiting',
  ]);
  expect(task.currentStepIndex).toBe(0);
  const completed = task;
  task = reduceEarnWorkflowTask(
    task,
    event('push', 'attempt', {
      kind: 'external',
      action: 'acceptedAfterInvalidation',
    }),
  );
  expect(task).toBe(completed);
});

it('only advances an unknown approval to its explicitly bound allowance check', () => {
  let task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
      { id: 'allowance', kind: 'wait' },
      { id: 'withdraw', kind: 'protocol', lateSubmitted: 'unknown' },
    ],
  });
  for (const action of [
    { type: 'start' },
    { type: 'confirmationOpened' },
    { type: 'sendStarted' },
  ] as const) {
    task = reduceEarnWorkflowTask(
      task,
      event('approve', 'a1', { kind: 'transaction', action }),
    );
  }
  task = reduceEarnWorkflowTask(
    task,
    event('approve', 'a1', { kind: 'confirmationCallbackPending' }),
  );
  task = reduceEarnWorkflowTask(
    task,
    event('approve', 'a1', {
      kind: 'transaction',
      action: { type: 'submitted', txid: '' },
    }),
  );
  const pending = task;
  const success = {
    kind: 'confirmationCallbackSucceeded',
    handoff: false,
    allowanceCheckStepId: 'allowance',
  } as const;
  expect(
    reduceEarnWorkflowTask(task, event('approve', 'other-attempt', success)),
  ).toBe(pending);
  expect(
    reduceEarnWorkflowTask(
      task,
      event('approve', 'a1', { ...success, allowanceCheckStepId: 'withdraw' }),
    ),
  ).toBe(pending);
  task = reduceEarnWorkflowTask(task, event('approve', 'a1', success));
  expect(task.currentStepIndex).toBe(1);
  expect(task.steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
  expect(task.steps[1].status.type).toBe('ready');
  expect(task.steps[2].status.type).toBe('waiting');
  expect(reduceEarnWorkflowTask(task, event('approve', 'a1', success))).toBe(
    task,
  );
});

it.each([
  { kind: 'protocol' as const, txid: '', next: 'wait' as const },
  { kind: 'approve' as const, txid: 'approval-tx', next: 'wait' as const },
  { kind: 'approve' as const, txid: '', next: 'protocol' as const },
])(
  'refuses a missing-txid allowance continuation for $kind $txid $next',
  ({ kind, txid, next }) => {
    let task = createEarnWorkflowTask({
      taskId: 'task',
      identity,
      steps: [
        { id: 'first', kind, lateSubmitted: 'unknown' },
        next === 'wait'
          ? { id: 'allowance', kind: 'wait' }
          : { id: 'allowance', kind: 'protocol', lateSubmitted: 'unknown' },
      ],
    });
    for (const action of [
      { type: 'start' },
      { type: 'confirmationOpened' },
      { type: 'sendStarted' },
    ] as const)
      task = reduceEarnWorkflowTask(
        task,
        event('first', 'a1', { kind: 'transaction', action }),
      );
    task = reduceEarnWorkflowTask(
      task,
      event('first', 'a1', { kind: 'confirmationCallbackPending' }),
    );
    task = reduceEarnWorkflowTask(
      task,
      event('first', 'a1', {
        kind: 'transaction',
        action: { type: 'submitted', txid },
      }),
    );
    const before = task;
    task = reduceEarnWorkflowTask(
      task,
      event('first', 'a1', {
        kind: 'confirmationCallbackSucceeded',
        handoff: false,
        allowanceCheckStepId: 'allowance',
      }),
    );
    expect(task).toBe(before);
  },
);
