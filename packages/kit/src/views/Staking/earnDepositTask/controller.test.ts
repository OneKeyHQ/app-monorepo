import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createDepositTaskController } from './controller';
import { createDepositTask, createDepositTaskState } from './state';

import type {
  IDepositTaskAdapter,
  IDepositTaskPreparation,
} from './controller';

const identity = {
  accountId: 'a',
  accountAddress: 'owner',
  networkId: 'n',
  provider: 'p',
  vault: 'v',
  inputTokenAddress: 't',
  depositTokenAddress: 't',
  amount: '1',
  spenderAddress: 's',
};
const makeTask = () =>
  createDepositTask({
    taskId: 'task',
    identity,
    steps: [
      { id: 'wrap', kind: 'wrap' },
      { id: 'approve', kind: 'approve' },
      { id: 'deposit', kind: 'deposit' },
    ],
  });

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Earn deposit task controller', () => {
  it('shares one execution lease across controllers for the same task', async () => {
    const state = createDepositTaskState(makeTask());
    const pending = deferred<IDepositTaskPreparation<unknown>>();
    const prepareFirst = jest.fn(() => pending.promise);
    const prepareSecond = jest.fn(async () => ({ type: 'cancelled' as const }));
    const common = {
      confirm: async () => ({ type: 'cancelled' as const }),
      waitForFinalStatus: async () => 'unknown' as const,
      verify: async () => false,
    };
    const first = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: { ...common, prepare: prepareFirst },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    const second = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: { ...common, prepare: prepareSecond },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    const running = first.run();
    await second.run();
    expect(prepareFirst).toHaveBeenCalledTimes(1);
    expect(prepareSecond).not.toHaveBeenCalled();
    pending.resolve({ type: 'cancelled' });
    await running;
    expect(second.getTask().steps[0].status.type).toBe('cancelled');
  });

  it('releases the lease if a cancellation listener throws', async () => {
    const state = createDepositTaskState(makeTask());
    const pending = deferred<IDepositTaskPreparation<unknown>>();
    const first = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: {
        prepare: async () => pending.promise,
        confirm: async () => ({ type: 'cancelled' }),
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    const oldRun = first.run();
    const unsubscribe = state.subscribe(() => {
      throw new OneKeyLocalError('listener failed');
    });
    expect(() => first.cancel()).toThrow('listener failed');
    unsubscribe();

    const prepare = jest.fn(async () => ({ type: 'cancelled' as const }));
    const second = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: {
        prepare,
        confirm: async () => ({ type: 'cancelled' }),
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await second.retry();
    expect(prepare).toHaveBeenCalledTimes(1);
    pending.resolve({ type: 'cancelled' });
    await oldRun;
  });

  it('rejects attaching an adapter for a different frozen amount', () => {
    const state = createDepositTaskState(makeTask());
    const otherTask = {
      ...state.getTask(),
      identity: { ...state.getTask().identity, amount: '2' },
    };
    expect(() =>
      createDepositTaskController({
        task: otherTask,
        taskState: state,
        adapter: {
          prepare: async () => ({ type: 'cancelled' }),
          confirm: async () => ({ type: 'cancelled' }),
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
        isCurrent: () => true,
        onChange: () => undefined,
      }),
    ).toThrow('Deposit task state identity mismatch');
  });

  it('does not report an error after a state listener cancels the owner', async () => {
    const onError = jest.fn();
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => {
          throw new OneKeyLocalError('preparation failed');
        },
        confirm: async () => ({ type: 'cancelled' }),
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: (task) => {
        if (task.steps[0].status.type === 'failed') controller.cancel();
      },
      onError,
    });
    await controller.run();
    expect(controller.getTask().steps[0].status.type).toBe('failed');
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not prepare after a synchronous owner cancellation', async () => {
    const prepare = jest.fn(async () => ({ type: 'cancelled' as const }));
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare,
        confirm: async () => ({ type: 'cancelled' }),
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: (task) => {
        if (task.steps[0].status.type === 'preparing') controller.cancel();
      },
    });
    await controller.run();
    expect(prepare).not.toHaveBeenCalled();
    expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  });

  it('does not open confirmation after a synchronous owner cancellation', async () => {
    const confirm = jest.fn(async () => ({ type: 'cancelled' as const }));
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm,
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: (task) => {
        if (task.steps[0].status.type === 'awaitingUser') controller.cancel();
      },
    });
    await controller.run();
    expect(confirm).not.toHaveBeenCalled();
    expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  });

  it('does not send when the owner is cancelled during send-start notification', async () => {
    const send = jest.fn();
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend }) => {
          onBeforeSend();
          send();
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: (task) => {
        if (task.steps[0].status.type === 'sending') controller.cancel();
      },
    });
    await controller.run();
    expect(send).not.toHaveBeenCalled();
  });

  it('preserves a late hash without letting an old controller cancel a new step', async () => {
    const state = createDepositTaskState(makeTask());
    const oldConfirmation = deferred<{ type: 'submitted' }>();
    const newConfirmation = deferred<{ type: 'cancelled' }>();
    const oldOpened = deferred<void>();
    const newOpened = deferred<void>();
    let reportOldHash: (txid: string) => void = () => undefined;
    let oldCurrent = true;
    const first = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          reportOldHash = onSubmitted;
          oldOpened.resolve();
          return oldConfirmation.promise;
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => oldCurrent,
      onChange: () => undefined,
    });
    const oldRun = first.run();
    await oldOpened.promise;
    oldCurrent = false;
    first.cancel();

    const prepareNew = jest.fn(async () => ({
      type: 'confirm' as const,
      prepared: undefined,
    }));
    const second = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: {
        prepare: prepareNew,
        confirm: async () => {
          newOpened.resolve();
          return newConfirmation.promise;
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await second.run();
    expect(prepareNew).not.toHaveBeenCalled();
    reportOldHash('wrap-tx');
    expect(second.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'wrap-tx',
      chainConfirmed: false,
    });
    await second.retryStatus();
    expect(second.getTask().steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'wrap-tx',
    });
    const newRun = second.run();
    await newOpened.promise;
    oldConfirmation.resolve({ type: 'submitted' });
    await oldRun;
    expect(second.getTask().steps[1].status.type).toBe('awaitingUser');
    newConfirmation.resolve({ type: 'cancelled' });
    await newRun;
  });

  it('ignores an old cancellation while the new owner checks the same transaction', async () => {
    const state = createDepositTaskState(makeTask());
    const oldConfirmation = deferred<{ type: 'cancelled' }>();
    const status = deferred<'success'>();
    const opened = deferred<void>();
    let reportHash: (txid: string) => void = () => undefined;
    let oldCurrent = true;
    const first = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          reportHash = onSubmitted;
          opened.resolve();
          return oldConfirmation.promise;
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => oldCurrent,
      onChange: () => undefined,
    });
    const oldRun = first.run();
    await opened.promise;
    oldCurrent = false;
    first.cancel();
    reportHash('wrap-tx');
    const second = createDepositTaskController({
      task: state.getTask(),
      taskState: state,
      adapter: {
        prepare: async () => ({ type: 'cancelled' }),
        confirm: async () => ({ type: 'cancelled' }),
        waitForFinalStatus: async () => status.promise,
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    const checking = second.retryStatus();
    expect(second.getTask().steps[0].status.type).toBe('confirming');
    oldConfirmation.resolve({ type: 'cancelled' });
    await oldRun;
    expect(second.getTask().steps[0].status.type).toBe('confirming');
    status.resolve('success');
    await checking;
    expect(second.getTask().steps[0].status.type).toBe('succeeded');
  });

  it('publishes a late hash as stale after the execution lease is cancelled', async () => {
    const confirmation = deferred<{ type: 'cancelled' }>();
    const opened = deferred<void>();
    const onChange = jest.fn();
    const onStaleChange = jest.fn();
    let reportHash: (txid: string) => void = () => undefined;
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          reportHash = onSubmitted;
          opened.resolve();
          return confirmation.promise;
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange,
      onStaleChange,
    });
    const running = controller.run();
    await opened.promise;
    controller.cancel();
    const publishedBeforeLateHash = onChange.mock.calls.length;
    reportHash('wrap-tx');
    expect(onChange).toHaveBeenCalledTimes(publishedBeforeLateHash);
    expect(onStaleChange).toHaveBeenCalledTimes(1);
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'wrap-tx',
      chainConfirmed: false,
    });
    confirmation.resolve({ type: 'cancelled' });
    await running;
  });

  it('runs a single plan in order and skips only the prepared approval', async () => {
    const calls: string[] = [];
    const adapter: IDepositTaskAdapter = {
      prepare: async ({ step }) => {
        calls.push(`prepare:${step.id}`);
        return step.id === 'approve'
          ? { type: 'skip' }
          : { type: 'confirm', prepared: step.id };
      },
      confirm: async ({ step, onBeforeSend, onSubmitted }) => {
        calls.push(`confirm:${step.id}`);
        onBeforeSend();
        onSubmitted(`${step.id}-tx`);
        return { type: 'submitted' };
      },
      waitForFinalStatus: async ({ step }) => {
        calls.push(`status:${step.id}`);
        return 'success';
      },
      verify: async ({ step }) => {
        calls.push(`verify:${step.id}`);
        return true;
      },
    };
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter,
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(calls).toEqual([
      'prepare:wrap',
      'confirm:wrap',
      'status:wrap',
      'verify:wrap',
      'prepare:approve',
      'prepare:deposit',
      'confirm:deposit',
    ]);
    expect(controller.getTask().steps.map((step) => step.status.type)).toEqual([
      'succeeded',
      'skipped',
      'handedOff',
    ]);
  });

  it('passes the prepared transaction and the current attempt to confirmation', async () => {
    const confirm = jest.fn<
      ReturnType<IDepositTaskAdapter<{ payload: string }>['confirm']>,
      Parameters<IDepositTaskAdapter<{ payload: string }>['confirm']>
    >();
    confirm.mockImplementation(
      async ({ prepared, onBeforeSend, onSubmitted }) => {
        onBeforeSend();
        onSubmitted(prepared.payload);
        return { type: 'submitted' };
      },
    );
    const controller = createDepositTaskController({
      task: createDepositTask({
        taskId: 'task',
        identity,
        steps: [{ id: 'deposit', kind: 'deposit' }],
      }),
      adapter: {
        prepare: async () => ({
          type: 'confirm',
          prepared: { payload: 'prepared-tx' },
        }),
        confirm,
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    const call = confirm.mock.calls[0][0];
    expect(call.taskId).toBe('task');
    expect(call.attemptId).toBe(call.step.attemptId);
    expect(call.step.status.type).toBe('preparing');
    expect(call.prepared).toEqual({ payload: 'prepared-tx' });
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'handedOff',
      txid: 'prepared-tx',
    });
  });

  it('accepts an order recording only for the submitted deposit attempt', async () => {
    const accepted: boolean[] = [];
    const controller = createDepositTaskController({
      task: createDepositTask({
        taskId: 'task',
        identity,
        steps: [{ id: 'deposit', kind: 'deposit' }],
      }),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          accepted.push(onSubmitted('deposit-tx'));
          accepted.push(onSubmitted('different-tx'));
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(accepted).toEqual([true, false]);
  });

  it('accepts the deposit hash before a synchronous page disposal can interrupt handoff', async () => {
    let accepted = false;
    let sawIntermediateConfirmation = false;
    let disposed = 0;
    const controller = createDepositTaskController({
      task: createDepositTask({
        taskId: 'task',
        identity,
        steps: [{ id: 'deposit', kind: 'deposit' }],
      }),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          accepted = onSubmitted('deposit-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      isCurrent: () => true,
      onChange: (task) => {
        if (task.steps[0].status.type === 'confirming') {
          sawIntermediateConfirmation = true;
          controller.cancel();
        }
        if (task.steps[0].status.type === 'handedOff') {
          disposed += 1;
          controller.cancel();
        }
      },
    });
    await controller.run();
    expect(accepted).toBe(true);
    expect(sawIntermediateConfirmation).toBe(false);
    expect(disposed).toBe(1);
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'handedOff',
      txid: 'deposit-tx',
    });
  });

  it('retains the final submission when the page closes inside the success callback', async () => {
    let current = true;
    const controller = createDepositTaskController({
      task: createDepositTask({
        taskId: 'task',
        identity,
        steps: [{ id: 'deposit', kind: 'deposit' }],
      }),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('deposit-tx');
          current = false;
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
      isCurrent: () => current,
      onChange: () => undefined,
    });
    await controller.run();
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'handedOff',
      txid: 'deposit-tx',
    });
  });

  it('stops without opening confirmation when the user cancels preparation', async () => {
    const confirm = jest.fn();
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'cancelled' }),
        confirm,
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(confirm).not.toHaveBeenCalled();
    expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  });

  it('locks concurrent starts and ignores completion after the scope is invalidated', async () => {
    const pending = deferred<IDepositTaskPreparation<unknown>>();
    const prepare = jest.fn(() => pending.promise);
    const confirm = jest.fn();
    let current = true;
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare,
        confirm,
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
      isCurrent: () => current,
      onChange: () => undefined,
    });
    const first = controller.run();
    await controller.run();
    expect(prepare).toHaveBeenCalledTimes(1);
    current = false;
    pending.resolve({ type: 'confirm', prepared: undefined });
    await first;
    expect(confirm).not.toHaveBeenCalled();
    expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  });

  it('does not continue or resubmit after a transaction status becomes unknown', async () => {
    const confirm = jest.fn<
      ReturnType<IDepositTaskAdapter['confirm']>,
      Parameters<IDepositTaskAdapter['confirm']>
    >(async ({ onBeforeSend, onSubmitted }) => {
      onBeforeSend();
      onSubmitted('tx-1');
      return { type: 'submitted' };
    });
    const status = jest
      .fn<
        ReturnType<IDepositTaskAdapter['waitForFinalStatus']>,
        Parameters<IDepositTaskAdapter['waitForFinalStatus']>
      >()
      .mockResolvedValueOnce('unknown')
      .mockResolvedValueOnce('success');
    const prepare = jest
      .fn<
        ReturnType<IDepositTaskAdapter['prepare']>,
        Parameters<IDepositTaskAdapter['prepare']>
      >()
      .mockResolvedValue({ type: 'confirm', prepared: undefined });
    const controller = createDepositTaskController({
      task: createDepositTask({
        taskId: 'task',
        identity,
        steps: [
          { id: 'wrap', kind: 'wrap' },
          { id: 'deposit', kind: 'deposit' },
        ],
      }),
      adapter: {
        prepare,
        confirm,
        waitForFinalStatus: status,
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'tx-1',
      chainConfirmed: false,
    });
    await controller.run();
    expect(confirm).toHaveBeenCalledTimes(1);
    await controller.retryStatus();
    expect(confirm.mock.calls.map(([context]) => context.step.id)).toEqual([
      'wrap',
    ]);
    expect(status).toHaveBeenCalledTimes(2);
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'tx-1',
    });
  });

  it('serializes reentrant status retries triggered by a synchronous listener', async () => {
    const pendingStatus = deferred<'success' | 'failed' | 'unknown'>();
    const status = jest
      .fn<
        ReturnType<IDepositTaskAdapter['waitForFinalStatus']>,
        Parameters<IDepositTaskAdapter['waitForFinalStatus']>
      >()
      .mockResolvedValueOnce('unknown')
      .mockReturnValueOnce(pendingStatus.promise);
    let reenter = false;
    const controller: ReturnType<typeof createDepositTaskController> =
      createDepositTaskController({
        task: makeTask(),
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: undefined }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: status,
          verify: async () => true,
        },
        isCurrent: () => true,
        onChange: (task) => {
          if (reenter && task.steps[0].status.type === 'confirming')
            void controller.retryStatus();
        },
      });
    await controller.run();
    reenter = true;
    const retry = controller.retryStatus();
    expect(status).toHaveBeenCalledTimes(2);
    pendingStatus.resolve('unknown');
    await retry;
    expect(status).toHaveBeenCalledTimes(2);
  });

  it('retains a late transaction id without notifying a changed scope', async () => {
    const pending = deferred<{ type: 'cancelled' }>();
    let submitted: ((txid: string) => void) | undefined;
    let current = true;
    const changed = jest.fn();
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          submitted = onSubmitted;
          return pending.promise;
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
      isCurrent: () => current,
      onChange: changed,
    });
    const run = controller.run();
    await Promise.resolve();
    current = false;
    controller.cancel();
    const count = changed.mock.calls.length;
    submitted?.('late-tx');
    expect(changed).toHaveBeenCalledTimes(count);
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'late-tx',
      chainConfirmed: false,
    });
    pending.resolve({ type: 'cancelled' });
    await run;
  });

  it('retries a cancelled approval without repeating the completed wrap', async () => {
    const calls: string[] = [];
    let approvalCancelled = false;
    const adapter: IDepositTaskAdapter = {
      prepare: async ({ step }) => {
        calls.push(`prepare:${step.id}`);
        return { type: 'confirm', prepared: undefined };
      },
      confirm: async ({ step, onBeforeSend, onSubmitted }) => {
        calls.push(`confirm:${step.id}`);
        if (step.id === 'approve' && !approvalCancelled) {
          approvalCancelled = true;
          return { type: 'cancelled' };
        }
        onBeforeSend();
        onSubmitted(`${step.id}-tx`);
        return { type: 'submitted' };
      },
      waitForFinalStatus: async () => 'success',
      verify: async () => true,
    };
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter,
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(controller.getTask().steps[1].status.type).toBe('cancelled');
    await controller.retry();
    expect(calls.filter((call) => call === 'confirm:wrap')).toHaveLength(1);
    expect(calls.filter((call) => call === 'confirm:approve')).toHaveLength(2);
    expect(controller.getTask().steps.map((step) => step.status.type)).toEqual([
      'succeeded',
      'succeeded',
      'handedOff',
    ]);
  });

  it('keeps a late submitted hash available for explicit status checking after cancellation', async () => {
    let lateSubmitted: ((txid: string) => void) | undefined;
    const confirm = jest.fn<
      ReturnType<IDepositTaskAdapter['confirm']>,
      Parameters<IDepositTaskAdapter['confirm']>
    >(async ({ onBeforeSend, onSubmitted }) => {
      onBeforeSend();
      lateSubmitted = onSubmitted;
      return { type: 'cancelled' };
    });
    const status = jest.fn().mockResolvedValue('success');
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm,
        waitForFinalStatus: status,
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
    lateSubmitted?.('late-tx');
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'late-tx',
      chainConfirmed: false,
    });
    expect(status).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);

    await controller.retryStatus();
    expect(status).toHaveBeenCalledTimes(1);
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'late-tx',
    });
    expect(controller.getTask().steps[1].status.type).toBe('ready');
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('can reconcile a late transaction id after cancellation without resending', async () => {
    const pending = deferred<{ type: 'cancelled' }>();
    let lateSubmitted: ((txid: string) => void) | undefined;
    const confirm: IDepositTaskAdapter['confirm'] = async ({
      onBeforeSend,
      onSubmitted,
    }) => {
      onBeforeSend();
      lateSubmitted = onSubmitted;
      return pending.promise;
    };
    const status = jest.fn().mockResolvedValue('success');
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm,
        waitForFinalStatus: status,
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    const run = controller.run();
    await Promise.resolve();
    controller.cancel();
    pending.resolve({ type: 'cancelled' });
    await run;
    expect(controller.getTask().steps[0].status.type).toBe('unknown');
    lateSubmitted?.('late-tx');
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'late-tx',
      chainConfirmed: false,
    });
    await controller.retryStatus();
    expect(status).toHaveBeenCalledTimes(1);
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'late-tx',
    });
  });

  it('stops if confirmation reports two different transaction ids', async () => {
    const waitForFinalStatus = jest.fn<
      ReturnType<IDepositTaskAdapter['waitForFinalStatus']>,
      Parameters<IDepositTaskAdapter['waitForFinalStatus']>
    >();
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('tx-a');
          onSubmitted('tx-b');
          return { type: 'submitted' };
        },
        waitForFinalStatus,
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
      txidConflict: ['tx-a', 'tx-b'],
    });
    await controller.retryStatus();
    expect(waitForFinalStatus).not.toHaveBeenCalled();
  });

  it('blocks conflicting late ids after cancellation', async () => {
    const pending = deferred<{ type: 'cancelled' }>();
    let submitted: ((txid: string) => void) | undefined;
    const status = jest.fn<
      ReturnType<IDepositTaskAdapter['waitForFinalStatus']>,
      Parameters<IDepositTaskAdapter['waitForFinalStatus']>
    >();
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          submitted = onSubmitted;
          onSubmitted('tx-a');
          return pending.promise;
        },
        waitForFinalStatus: status,
        verify: async () => true,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    const run = controller.run();
    await Promise.resolve();
    controller.cancel();
    submitted?.('tx-b');
    pending.resolve({ type: 'cancelled' });
    await run;
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
      txidConflict: ['tx-a', 'tx-b'],
    });
    await controller.retryStatus();
    expect(status).not.toHaveBeenCalled();
  });

  it('blocks a conflicting id while checking a confirmed transaction postcondition', async () => {
    const pending = deferred<boolean>();
    let submitted: ((txid: string) => void) | undefined;
    const controller = createDepositTaskController({
      task: makeTask(),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          submitted = onSubmitted;
          onSubmitted('tx-a');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => pending.promise,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    const run = controller.run();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(controller.getTask().steps[0].status.type).toBe('verifying');
    submitted?.('tx-b');
    pending.resolve(true);
    await run;
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
      txidConflict: ['tx-a', 'tx-b'],
    });
    expect(controller.getTask().currentStepIndex).toBe(0);
  });

  it('stops after a successful transaction when its postcondition is unavailable', async () => {
    const confirm = jest.fn<
      ReturnType<IDepositTaskAdapter['confirm']>,
      Parameters<IDepositTaskAdapter['confirm']>
    >(async ({ onBeforeSend, onSubmitted }) => {
      onBeforeSend();
      onSubmitted('tx-1');
      return { type: 'submitted' };
    });
    const verify = jest
      .fn<
        ReturnType<IDepositTaskAdapter['verify']>,
        Parameters<IDepositTaskAdapter['verify']>
      >()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const controller = createDepositTaskController({
      task: createDepositTask({
        taskId: 'task',
        identity,
        steps: [
          { id: 'approve', kind: 'approve' },
          { id: 'deposit', kind: 'deposit' },
        ],
      }),
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm,
        waitForFinalStatus: async () => 'success',
        verify,
      },
      isCurrent: () => true,
      onChange: () => undefined,
    });
    await controller.run();
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'tx-1',
      chainConfirmed: true,
    });
    await controller.retryStatus();
    expect(confirm.mock.calls.map(([context]) => context.step.id)).toEqual([
      'approve',
    ]);
    expect(controller.getTask().steps[0].status.type).toBe('succeeded');
  });
});
