import { createEarnWorkflowTaskController } from './earnWorkflowTaskController';
import { createEarnWorkflowTask } from './earnWorkflowTaskState';

const identity = {
  accountId: 'account',
  networkId: 'sol--101',
  provider: 'provider',
};

it('retains timeout as pending while allowing the next explicit workflow step', async () => {
  const next = jest.fn(async () => ({ type: 'unknown' as const }));
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'finality', kind: 'wait' },
      { id: 'quote', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {},
    retained: true,
    facts: {
      initial: { finality: 'notQueried' },
      reduce: (facts: { finality: string }, event: { finality: string }) => ({
        ...facts,
        ...event,
      }),
    },
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step) => ({
      kind: 'wait',
      run:
        step.id === 'finality'
          ? async () => ({
              type: 'pending',
              context: {},
              fact: { finality: 'pending' },
            })
          : next,
    }),
  });
  const snapshots: Array<{ finality: string | undefined; step: string }> = [];
  controller.subscribe(() => {
    const state = controller.getTask();
    snapshots.push({
      finality: state.facts?.finality,
      step: state.steps[0].status.type,
    });
  });
  const owner = controller.attachOwner(() => true);
  await controller.run(owner);
  expect(next).toHaveBeenCalledTimes(1);
  expect(controller.getTask().steps[0].status.type).toBe('continued');
  expect(controller.getTask().facts).toEqual({ finality: 'pending' });
  expect(
    snapshots
      .filter((item) => item.finality === 'pending')
      .every((item) => item.step === 'continued'),
  ).toBe(true);
  const waitAttempt = controller.getTask().steps[0].attemptId ?? '';
  expect(
    controller.recordFact({
      stepId: 'finality',
      attemptId: waitAttempt,
      fact: { finality: 'confirmed' },
    }),
  ).toBe(true);
  expect(controller.getTask().facts).toEqual({ finality: 'confirmed' });
  expect(controller.getTask().currentStepIndex).toBe(1);
});

it('requires a newly attached owner after detaching and never continues the old intent', async () => {
  let resolve: () => void = () => undefined;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const next = jest.fn(async () => ({
    type: 'completed' as const,
    context: {},
  }));
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'wait', kind: 'wait' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {},
    retained: true,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step) => ({
      kind: 'wait',
      run:
        step.id === 'wait'
          ? async () => {
              await pending;
              return { type: 'completed', context: {} };
            }
          : next,
    }),
  });
  const oldOwner = controller.attachOwner(() => true);
  const running = controller.run(oldOwner);
  await Promise.resolve();
  controller.detachOwner(oldOwner);
  const newOwner = controller.attachOwner(() => true);
  resolve();
  await running;
  expect(next).not.toHaveBeenCalled();
  await controller.run(oldOwner);
  expect(next).not.toHaveBeenCalled();
  await controller.retryWait(newOwner);
  expect(next).toHaveBeenCalledTimes(1);
});

it('accepts attempt-bound late facts after detachment and rejects a different attempt', async () => {
  let resolve: () => void = () => undefined;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [{ id: 'builder', kind: 'external' }],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {},
    retained: true,
    facts: {
      initial: { txid: '' },
      reduce: (facts: { txid: string }, event: { txid: string }) => ({
        ...facts,
        ...event,
      }),
    },
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: () => ({
      kind: 'external',
      prepare: async ({ context }) => context,
      execute: async () => {
        await pending;
        return { type: 'unknown' };
      },
    }),
  });
  const owner = controller.attachOwner(() => true);
  const running = controller.run(owner);
  await Promise.resolve();
  await Promise.resolve();
  const attemptId = controller.getTask().steps[0].attemptId;
  expect(attemptId).toBeTruthy();
  controller.detachOwner(owner);
  expect(
    controller.recordFact({
      stepId: 'builder',
      attemptId: 'wrong',
      fact: { txid: 'wrong' },
    }),
  ).toBe(false);
  expect(
    controller.recordFact({
      stepId: 'builder',
      attemptId: attemptId ?? '',
      fact: { txid: 'submitted-tx' },
    }),
  ).toBe(true);
  expect(controller.getTask().facts).toEqual({ txid: 'submitted-tx' });
  resolve();
  await running;
});

it('reconciles the original submitted transaction under the new owner without rebuilding it', async () => {
  let submit: ((txid: string) => boolean) | undefined;
  const prepare = jest.fn(async () => ({
    type: 'confirm' as const,
    prepared: undefined,
  }));
  const wait = jest.fn(async () => 'success' as const);
  const next = jest.fn(async () => ({ type: 'unknown' as const }));
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'setup', kind: 'protocol', lateSubmitted: 'unknown' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: { txid: '' },
    retained: true,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              expect(context.txid).toBe('original-tx');
              return next();
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: false,
            submittedContext: (previous, txid) => ({ ...previous, txid }),
            adapter: {
              confirmationLifecycle: 'detached',
              prepare,
              confirm: async ({ onSubmitted }) => {
                submit = onSubmitted;
                return { type: 'detached' };
              },
              waitForFinalStatus: wait,
              verify: async () => true,
            },
          },
  });
  const first = controller.attachOwner(() => true);
  await controller.run(first);
  controller.detachOwner(first);
  submit?.('original-tx');
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    txid: 'original-tx',
    chainConfirmed: false,
  });
  const second = controller.attachOwner(() => true);
  await controller.run(second);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(wait).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(1);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'succeeded',
    txid: 'original-tx',
  });
});

it('only retries a safely cancelled transaction after the new owner explicitly requests it', async () => {
  const prepare = jest.fn(async () => ({
    type: 'confirm' as const,
    prepared: undefined,
  }));
  let count = 0;
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [{ id: 'setup', kind: 'protocol', lateSubmitted: 'unknown' }],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {},
    retained: true,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare,
        confirm: async ({ onSubmitted }) => {
          count += 1;
          if (count === 1) return { type: 'cancelled' };
          onSubmitted('setup-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
    }),
  });
  const first = controller.attachOwner(() => true);
  await controller.run(first);
  expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  controller.detachOwner(first);
  const second = controller.attachOwner(() => true);
  await controller.run(second);
  expect(prepare).toHaveBeenCalledTimes(1);
  await controller.retryTransaction(second);
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(controller.getTask().steps[0].status.type).toBe('handedOff');
});

it('never retries a transaction whose send outcome is unknown', async () => {
  const prepare = jest.fn(async () => ({
    type: 'confirm' as const,
    prepared: undefined,
  }));
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [{ id: 'setup', kind: 'protocol', lateSubmitted: 'unknown' }],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {},
    retained: true,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare,
        confirm: async ({ onBeforeSend }) => {
          onBeforeSend();
          return { type: 'cancelled' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
    }),
  });
  const owner = controller.attachOwner(() => true);
  await controller.run(owner);
  expect(controller.getTask().steps[0].status.type).toBe('unknown');
  await controller.retryTransaction(owner);
  expect(prepare).toHaveBeenCalledTimes(1);
});

it('reports busy to a new owner until the detached old attempt actually settles', async () => {
  let resolve: () => void = () => undefined;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  let attempts = 0;
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity,
    steps: [{ id: 'wait', kind: 'wait' }],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {},
    retained: true,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: () => ({
      kind: 'wait',
      run: async () => {
        attempts += 1;
        if (attempts === 1) await pending;
        return { type: 'completed', context: {} };
      },
    }),
  });
  const first = controller.attachOwner(() => true);
  const oldRun = controller.run(first);
  await Promise.resolve();
  controller.detachOwner(first);
  const second = controller.attachOwner(() => true);
  await expect(controller.tryRetryWait(second)).resolves.toBe('busy');
  resolve();
  await oldRun;
  expect(attempts).toBe(1);
  await expect(controller.tryRetryWait(second)).resolves.toBe('started');
  expect(attempts).toBe(2);
});
