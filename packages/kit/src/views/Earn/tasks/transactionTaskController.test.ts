import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskStore } from './createEarnTaskStore';
import { reduceEarnTransactionStep } from './transactionStep';
import { createEarnTransactionTaskController } from './transactionTaskController';

import type {
  IEarnTransactionStepAction,
  IEarnTransactionStepStatus,
} from './transactionStep';
import type {
  IEarnTransactionTaskAdapter,
  IEarnTransactionTaskPreparation,
} from './transactionTaskController';

type IIdentity = { accountId: string; networkId: string };
type IStep = {
  id: string;
  kind: 'fund' | 'borrow';
  attemptId?: string;
  status: IEarnTransactionStepStatus;
};
type ITask = {
  taskId: string;
  identity: IIdentity;
  steps: IStep[];
  currentStepIndex: number;
};
type IEvent = IEarnTransactionStepAction & {
  taskId: string;
  stepId: string;
  attemptId: string;
};
type IPreparation = IEarnTransactionTaskPreparation<string, never>;
type IAdapter = IEarnTransactionTaskAdapter<
  IIdentity,
  IStep,
  string,
  IPreparation
>;

function createHarness(
  adapter: IAdapter,
  leaseOwner?: symbol,
  options?: {
    isCurrent?: () => boolean;
    onStaleError?: (error: unknown) => void;
  },
) {
  const initialTask: ITask = {
    taskId: 'borrow-task',
    identity: { accountId: 'account', networkId: 'network' },
    steps: [
      { id: 'fund', kind: 'fund', status: { type: 'ready' } },
      { id: 'borrow', kind: 'borrow', status: { type: 'waiting' } },
    ],
    currentStepIndex: 0,
  };
  const store = createEarnTaskStore<ITask, IEvent>({
    initialState: initialTask,
    reduce: (task, event) => {
      const step = task.steps[task.currentStepIndex];
      if (!step || task.taskId !== event.taskId || step.id !== event.stepId)
        return task;
      if (event.type === 'handoff' && step.kind !== 'borrow') return task;
      const transition = reduceEarnTransactionStep(step, event, {
        lateSubmitted: step.kind === 'borrow' ? 'confirming' : 'unknown',
      });
      if (!transition) return task;
      const nextIndex = task.currentStepIndex + (transition.advance ? 1 : 0);
      const steps = task.steps.map((item, index) => {
        if (index === task.currentStepIndex)
          return {
            ...item,
            attemptId: transition.attemptId,
            status: transition.status,
          };
        if (transition.advance && index === nextIndex)
          return { ...item, status: { type: 'ready' as const } };
        return item;
      });
      return { ...task, currentStepIndex: nextIndex, steps };
    },
  });
  const bind = (
    stepId: string,
    attemptId: string,
    action: IEarnTransactionStepAction,
  ): IEvent => ({
    ...action,
    taskId: initialTask.taskId,
    stepId,
    attemptId,
  });
  const onChange = jest.fn<void, [ITask]>();
  const onStaleChange = jest.fn<void, [ITask]>();
  const controller = createEarnTransactionTaskController<
    IIdentity,
    IStep,
    ITask,
    string,
    never,
    IPreparation
  >({
    state: {
      getTask: store.getState,
      acquire: store.acquire,
      owns: store.owns,
      release: store.release,
      dispatch: (stepId, attemptId, action) =>
        store.dispatch(bind(stepId, attemptId, action)),
      dispatchBatch: (stepId, attemptId, actions) =>
        store.dispatchBatch(
          actions.map((action) => bind(stepId, attemptId, action)),
        ),
      applyPlanChange: () => false,
    },
    adapter,
    normalizePreparation: (value) => value,
    shouldHandoffOnSubmit: (step) => step.kind === 'borrow',
    isCurrent: options?.isCurrent ?? (() => true),
    onStaleError: options?.onStaleError,
    onChange,
    onStaleChange,
    expiredMessage: 'expired',
    leaseOwner,
  });
  return { controller, onChange, onStaleChange, store };
}

it('runs one transaction under its caller lease without releasing or advancing the next action', async () => {
  const owner = Symbol('workflow');
  const prepare = jest.fn(async ({ step }: { step: IStep }) => ({
    type: 'confirm' as const,
    prepared: step.id,
  }));
  const { controller, store } = createHarness(
    {
      prepare,
      confirm: async ({ step, onBeforeSend, onSubmitted }) => {
        onBeforeSend();
        onSubmitted(`${step.id}-tx`);
        return { type: 'submitted' };
      },
      waitForFinalStatus: async () => 'success',
      verify: async () => true,
    },
    owner,
  );
  await controller.runStepUnderLease();
  expect(prepare).not.toHaveBeenCalled();
  expect(store.acquire(owner)).toBe(true);
  await controller.runStepUnderLease();
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(store.getState().currentStepIndex).toBe(1);
  expect(store.owns(owner)).toBe(true);
  expect(store.acquire(Symbol('other'))).toBe(false);
  store.release(owner);
});

it('runs a non-deposit plan with one shared state and an explicit final handoff', async () => {
  const verify = jest.fn(async () => true);
  const adapter: IAdapter = {
    prepare: async ({ step }) => ({ type: 'confirm', prepared: step.id }),
    confirm: async ({ step, onBeforeSend, onSubmitted }) => {
      onBeforeSend();
      expect(onSubmitted(`${step.id}-tx`)).toBe(true);
      return { type: 'submitted' };
    },
    waitForFinalStatus: async () => 'success',
    verify,
  };
  const { controller } = createHarness(adapter);
  await controller.run();
  expect(verify).toHaveBeenCalledTimes(1);
  expect(controller.getTask().steps.map(({ status }) => status)).toEqual([
    { type: 'succeeded', txid: 'fund-tx' },
    { type: 'handedOff', txid: 'borrow-tx' },
  ]);
});

it('keeps a late hash recoverable after a non-final transaction is cancelled', async () => {
  let submitted: ((txid: string) => boolean) | undefined;
  let resolveConfirmation:
    | ((result: { type: 'cancelled' }) => void)
    | undefined;
  const confirmation = new Promise<{ type: 'cancelled' }>((resolve) => {
    resolveConfirmation = resolve;
  });
  const adapter: IAdapter = {
    prepare: async () => ({ type: 'confirm', prepared: 'fund' }),
    confirm: async ({ onBeforeSend, onSubmitted }) => {
      onBeforeSend();
      submitted = onSubmitted;
      return confirmation;
    },
    waitForFinalStatus: async () => 'success',
    verify: async () => true,
  };
  const { controller, onStaleChange } = createHarness(adapter);
  const running = controller.run();
  await Promise.resolve();
  controller.cancel();
  expect(submitted?.('fund-tx')).toBe(true);
  resolveConfirmation?.({ type: 'cancelled' });
  await running;
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    txid: 'fund-tx',
    chainConfirmed: false,
  });
  expect(onStaleChange).toHaveBeenCalled();
});

it.each([false, true])(
  'keeps stale errors opt-in (enabled=%s)',
  async (enabled) => {
    let rejectPrepare: ((error: Error) => void) | undefined;
    let current = true;
    const pending = new Promise<IPreparation>((_resolve, reject) => {
      rejectPrepare = reject;
    });
    const failure = new OneKeyLocalError('prepare failed');
    const adapter: IAdapter = {
      prepare: async () => pending,
      confirm: async () => ({ type: 'cancelled' }),
      waitForFinalStatus: async () => 'success',
      verify: async () => true,
    };
    const { controller, store } = createHarness(adapter, undefined, {
      isCurrent: () => current,
      onStaleError: enabled
        ? (error) => {
            throw error;
          }
        : undefined,
    });
    const running = controller.run();
    current = false;
    rejectPrepare?.(failure);
    if (enabled) await expect(running).rejects.toBe(failure);
    else await expect(running).resolves.toBeUndefined();
    expect(store.acquire(Symbol('another-owner'))).toBe(true);
  },
);

it.each(['sending', 'unknown', 'confirming', 'late hash'] as const)(
  'only releases the current sending attempt on a safe failure (prior=%s)',
  async (prior) => {
    let callbacks: Parameters<IAdapter['confirm']>[0] | undefined;
    const { controller } = createHarness({
      confirmationLifecycle: 'detached',
      prepare: async () => ({ type: 'confirm', prepared: 'fund' }),
      confirm: async (context) => {
        callbacks = context;
        return { type: 'detached' };
      },
      waitForFinalStatus: async () => 'unknown',
      verify: async () => false,
    });
    await controller.run();
    if (!callbacks) throw new OneKeyLocalError('Missing confirmation');
    callbacks.onSendObserved();
    if (prior === 'confirming') callbacks.onSubmitted('accepted-tx');
    if (prior === 'unknown' || prior === 'late hash')
      callbacks.onConfirmationFailed('unknown');
    if (prior === 'late hash') callbacks.onLateBroadcastAccepted('accepted-tx');
    callbacks.onConfirmationFailed('beforeSend');
    expect(controller.getTask().steps[0].status).toEqual(
      prior === 'sending'
        ? { type: 'failed', stage: 'beforeSend' }
        : {
            type: 'unknown',
            chainConfirmed: false,
            ...(prior === 'unknown' ? {} : { txid: 'accepted-tx' }),
          },
    );
  },
);
