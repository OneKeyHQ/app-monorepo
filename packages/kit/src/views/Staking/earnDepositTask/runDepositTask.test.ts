import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createDepositRecording, runDepositTask } from './runDepositTask';
import { createDepositTask, createDepositTaskState } from './state';

import type { IDepositTaskAdapter } from './controller';
import type { IRecoverableDepositTaskHandle } from './runDepositTask';
import type { IDepositTaskHandle } from './types';

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn(), message: jest.fn() },
}));

function isRecoverableHandle(
  handle: IDepositTaskHandle,
): handle is IRecoverableDepositTaskHandle {
  return (
    'subscribeRecovery' in handle &&
    typeof handle.subscribeRecovery === 'function' &&
    'retryDetachedRecording' in handle &&
    typeof handle.retryDetachedRecording === 'function'
  );
}

const makeTask = () =>
  createDepositTask({
    taskId: 'task',
    identity: {
      accountId: 'account',
      accountAddress: 'owner',
      networkId: 'network',
      provider: 'provider',
      vault: 'vault',
      inputTokenAddress: 'token',
      depositTokenAddress: 'token',
      amount: '1',
      spenderAddress: 'spender',
    },
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });

describe('deposit task lifecycle', () => {
  it('continues a retained task at its cancelled step without repeating wrap', async () => {
    const original = createDepositTask({
      taskId: 'resumed-wrap',
      identity: makeTask().identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const state = createDepositTaskState(original);
    const wrap = {
      taskId: original.taskId,
      stepId: 'wrap',
      attemptId: 'wrap-1',
    };
    state.dispatch({ ...wrap, type: 'start' });
    state.dispatch({ ...wrap, type: 'confirmationOpened' });
    state.dispatch({ ...wrap, type: 'sendStarted' });
    state.dispatch({ ...wrap, type: 'submitted', txid: 'wrap-tx' });
    state.dispatch({ ...wrap, type: 'confirmed' });
    state.dispatch({ ...wrap, type: 'verified' });
    const deposit = {
      taskId: original.taskId,
      stepId: 'deposit',
      attemptId: 'deposit-1',
    };
    state.dispatch({ ...deposit, type: 'start' });
    state.dispatch({ ...deposit, type: 'cancel' });
    const prepare: jest.MockedFunction<IDepositTaskAdapter['prepare']> =
      jest.fn(
        async (_context: Parameters<IDepositTaskAdapter['prepare']>[0]) => ({
          type: 'cancelled' as const,
        }),
      );
    await runDepositTask({
      task: state.getTask(),
      taskState: state,
      resume: true,
      adapter: {
        prepare,
        confirm: async () => ({ type: 'cancelled' }),
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      signal: new AbortController().signal,
      isCurrent: () => true,
      onTaskReady: () => true,
      formatMessage: (id) => id,
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare.mock.calls[0][0].step.kind).toBe('deposit');
    expect(prepare.mock.calls[0][0].isRetry).toBe(true);
    expect(state.getTask().steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'wrap-tx',
    });
  });

  it('does not save an order when the shared task rejects its recording binding', async () => {
    const save = jest.fn(async () => undefined);
    const recording = createDepositRecording({
      isCurrent: () => true,
      onError: jest.fn(),
    });
    recording.subscribeState(() => false);
    await recording.start('tx', save, () => undefined, {
      taskId: 'task',
      stepId: 'deposit',
      attemptId: 'stale-attempt',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    {
      status: 'remoteUnknown' as const,
      withNewRecorder: false,
      completed: false,
    },
    { status: 'succeeded' as const, withNewRecorder: true, completed: true },
  ])(
    'publishes and evaluates the current shared recording: $status',
    async ({ status, withNewRecorder, completed }) => {
      const original = makeTask();
      const state = createDepositTaskState(original);
      const event = {
        taskId: original.taskId,
        stepId: 'deposit',
        attemptId: 'attempt',
      };
      state.dispatch({ ...event, type: 'start' });
      state.dispatch({ ...event, type: 'confirmationOpened' });
      state.dispatch({ ...event, type: 'sendStarted' });
      state.dispatch({ ...event, type: 'submitted', txid: 'tx' });
      state.dispatch({ ...event, type: 'handoff' });
      expect(
        state.setRecording(Symbol('original'), event, { txid: 'tx', status }),
      ).toBe(true);
      const snapshot = state.getTask();
      const onTaskChange = jest.fn();
      const recording = withNewRecorder
        ? createDepositRecording({ isCurrent: () => true, onError: jest.fn() })
        : undefined;
      await expect(
        runDepositTask({
          task: original,
          taskState: state,
          adapter: {
            prepare: async () => ({ type: 'cancelled' }),
            confirm: async () => ({ type: 'cancelled' }),
            waitForFinalStatus: async () => 'unknown',
            verify: async () => false,
          },
          signal: new AbortController().signal,
          isCurrent: () => true,
          onTaskReady: () => undefined,
          onTaskChange,
          formatMessage: (id) => id,
          recording,
        }),
      ).resolves.toBe(completed);
      expect(onTaskChange).toHaveBeenCalledWith(snapshot);
    },
  );

  it('keeps a late order recording in shared state after the page is disposed', async () => {
    const taskState = createDepositTaskState(makeTask());
    let current = true;
    let deliver: () => void = () => undefined;
    let finishSave: () => void = () => undefined;
    let save: Promise<void> | undefined;
    let entered: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const recording = createDepositRecording({
      isCurrent: () => current,
      onError: jest.fn(),
    });
    const adapter: IDepositTaskAdapter = {
      prepare: async () => ({ type: 'confirm', prepared: undefined }),
      confirm: async ({
        taskId,
        step,
        attemptId,
        onBeforeSend,
        onSubmitted,
      }) => {
        onBeforeSend();
        entered();
        await new Promise<void>((resolve) => {
          deliver = () => {
            if (onSubmitted('deposit-tx')) {
              save = recording.start(
                'deposit-tx',
                () =>
                  new Promise<void>((done) => {
                    finishSave = done;
                  }),
                () => undefined,
                { taskId, stepId: step.id, attemptId },
              );
            }
            resolve();
          };
        });
        return { type: 'submitted' };
      },
      waitForFinalStatus: async () => 'unknown',
      verify: async () => false,
    };
    const signal = new AbortController();
    const onTaskChange = jest.fn();
    let handle: IDepositTaskHandle | undefined;
    const running = runDepositTask({
      task: taskState.getTask(),
      taskState,
      adapter,
      signal: signal.signal,
      isCurrent: () => current,
      onTaskReady: (value) => {
        handle = value;
      },
      onTaskChange,
      formatMessage: (id) => id,
      recording,
    });
    await opened;
    current = false;
    signal.abort();
    handle?.dispose();
    const oldUiUpdates = onTaskChange.mock.calls.length;
    deliver();
    await Promise.resolve();
    await Promise.resolve();
    expect(taskState.getTask().recording).toEqual({
      txid: 'deposit-tx',
      status: 'pending',
    });
    finishSave();
    await save;
    await running;
    expect(taskState.getTask().recording).toEqual({
      txid: 'deposit-tx',
      status: 'succeeded',
    });
    expect(onTaskChange).toHaveBeenCalledTimes(oldUiUpdates);
  });

  it('records an accepted deposit when a subscriber disposes the page during handoff', async () => {
    const taskState = createDepositTaskState(makeTask());
    let current = true;
    let disposed = 0;
    let handle: IDepositTaskHandle | undefined;
    const save = jest.fn(async () => undefined);
    const complete = jest.fn();
    const onTaskChange = jest.fn();
    const recording = createDepositRecording({
      isCurrent: () => current,
      onError: jest.fn(),
    });
    taskState.subscribe(() => {
      if (current && taskState.getTask().steps[0].status.type === 'handedOff') {
        current = false;
        disposed += 1;
        handle?.dispose();
      }
    });
    const result = await runDepositTask({
      task: taskState.getTask(),
      taskState,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: undefined }),
        confirm: async ({
          taskId,
          step,
          attemptId,
          onBeforeSend,
          onSubmitted,
        }) => {
          onBeforeSend();
          if (onSubmitted('deposit-tx')) {
            await recording.start('deposit-tx', save, complete, {
              taskId,
              stepId: step.id,
              attemptId,
            });
          }
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
      signal: new AbortController().signal,
      isCurrent: () => current,
      onTaskReady: (value) => {
        handle = value;
      },
      onTaskChange,
      formatMessage: (id) => id,
      recording,
    });
    expect(result).toBe(true);
    expect(disposed).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(taskState.getTask().recording).toEqual({
      txid: 'deposit-tx',
      status: 'succeeded',
    });
    expect(
      onTaskChange.mock.calls.every(
        ([snapshot]) => snapshot.steps[0].status.type !== 'handedOff',
      ),
    ).toBe(true);
  });

  it('does not prepare or publish a task rejected by its owner', async () => {
    const prepare = jest.fn(async () => ({ type: 'cancelled' as const }));
    const onTaskChange = jest.fn();
    const adapter: IDepositTaskAdapter = {
      prepare,
      confirm: async () => ({ type: 'cancelled' }),
      waitForFinalStatus: async () => 'unknown',
      verify: async () => false,
    };

    await expect(
      runDepositTask({
        task: makeTask(),
        adapter,
        signal: new AbortController().signal,
        isCurrent: () => true,
        onTaskReady: () => false,
        onTaskChange,
        formatMessage: (id) => id,
      }),
    ).resolves.toBe(false);
    expect(prepare).not.toHaveBeenCalled();
    expect(onTaskChange).not.toHaveBeenCalled();
  });

  it('cleans up and propagates an owner registration error', async () => {
    const prepare = jest.fn(async () => ({ type: 'cancelled' as const }));
    const controller = new AbortController();
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
    const error = new OneKeyLocalError('Task owner unavailable');

    await expect(
      runDepositTask({
        task: makeTask(),
        adapter: {
          prepare,
          confirm: async () => ({ type: 'cancelled' }),
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
        signal: controller.signal,
        isCurrent: () => true,
        onTaskReady: () => {
          throw error;
        },
        formatMessage: (id) => id,
      }),
    ).rejects.toBe(error);
    expect(prepare).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('notifies recovery observers of a late transaction and registration without publishing to the old UI', async () => {
    let current = true;
    let send: (txid: string) => void = () => undefined;
    let finishSave: () => void = () => undefined;
    let saving: Promise<void> | undefined;
    let entered: () => void = () => undefined;
    const enteredConfirmation = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const recording = createDepositRecording({
      isCurrent: () => current,
      onError: jest.fn(),
    });
    const adapter: IDepositTaskAdapter = {
      prepare: async () => ({ type: 'confirm', prepared: undefined }),
      confirm: async ({
        taskId,
        step,
        attemptId,
        onBeforeSend,
        onSubmitted,
      }) => {
        onBeforeSend();
        entered();
        await new Promise<void>((resolve) => {
          send = (txid) => {
            onSubmitted(txid);
            saving = recording.start(
              txid,
              () =>
                new Promise<void>((done) => {
                  finishSave = done;
                }),
              () => undefined,
              { taskId, stepId: step.id, attemptId },
            );
            resolve();
          };
        });
        return { type: 'submitted' };
      },
      waitForFinalStatus: async () => 'unknown',
      verify: async () => false,
    };
    const signal = new AbortController();
    let getTask: IDepositTaskHandle['getTask'] | undefined;
    const changes: string[] = [];
    const onTaskChange = jest.fn();
    const running = runDepositTask({
      task: makeTask(),
      adapter,
      signal: signal.signal,
      isCurrent: () => current,
      canPublishRecording: () => current,
      onTaskReady: (value) => {
        if (isRecoverableHandle(value)) {
          getTask = value.getTask;
          value.subscribeRecovery(() => {
            changes.push(
              value.getTask().recording?.status ??
                value.getTask().steps.at(-1)?.status.type ??
                '',
            );
          });
        }
      },
      onTaskChange,
      formatMessage: (id) => id,
      recording,
    });
    await enteredConfirmation;
    current = false;
    signal.abort();
    const published = onTaskChange.mock.calls.length;
    send('tx');
    await Promise.resolve();
    await Promise.resolve();
    expect(getTask?.().recording?.status).toBe('pending');
    expect(changes).toContain('pending');
    finishSave();
    await saving;
    await running;
    expect(getTask?.().recording?.status).toBe('succeeded');
    expect(changes).toContain('succeeded');
    expect(onTaskChange).toHaveBeenCalledTimes(published);
  });

  it('retries detached registration only while its new lease is current and never calls the old completion', async () => {
    let recoveryCurrent = true;
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const complete = jest.fn();
    const onError = jest.fn();
    const recording = createDepositRecording({
      isCurrent: () => false,
      onError,
    });
    await recording.start('tx', save, complete);
    expect(recording.getState()?.status).toBe('failed');

    const cancelled = recording.retryDetached(() => recoveryCurrent);
    recoveryCurrent = false;
    await cancelled;
    expect(save).toHaveBeenCalledTimes(1);
    expect(recording.getState()?.status).toBe('failed');

    recoveryCurrent = true;
    await Promise.all([
      recording.retryDetached(() => recoveryCurrent),
      recording.retryDetached(() => recoveryCurrent),
    ]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(recording.getState()?.status).toBe('succeeded');
    expect(complete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('retries an unavailable local registration but never retries an unknown remote result', async () => {
    const save = jest
      .fn()
      .mockResolvedValueOnce('localUnavailable')
      .mockResolvedValueOnce('remoteUnknown')
      .mockResolvedValue(undefined);
    const recording = createDepositRecording({
      isCurrent: () => true,
      onError: jest.fn(),
    });
    await recording.start('tx', save, jest.fn());
    expect(recording.getState()?.status).toBe('localUnavailable');
    await Promise.all([recording.retry(), recording.retry()]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(recording.getState()?.status).toBe('remoteUnknown');
    await recording.retry();
    await recording.retryDetached(() => true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('retries local registration after a detached lease is reacquired', async () => {
    let current = true;
    const save = jest
      .fn()
      .mockResolvedValueOnce('localUnavailable')
      .mockResolvedValueOnce('localUnavailable')
      .mockResolvedValue(undefined);
    const complete = jest.fn();
    const recording = createDepositRecording({
      isCurrent: () => false,
      onError: jest.fn(),
    });
    await recording.start('tx', save, complete);
    const cancelled = recording.retryDetached(() => current);
    current = false;
    await cancelled;
    expect(save).toHaveBeenCalledTimes(1);
    current = true;
    await expect(recording.retryDetached(() => current)).rejects.toThrow();
    expect(recording.getState()?.status).toBe('localUnavailable');
    await recording.retryDetached(() => current);
    expect(recording.getState()?.status).toBe('succeeded');
    expect(save).toHaveBeenCalledTimes(3);
    expect(complete).not.toHaveBeenCalled();
  });

  it('can retry a recording operation that throws before returning a promise', async () => {
    let calls = 0;
    const save = () => {
      calls += 1;
      if (calls === 1) throw new OneKeyLocalError('storage unavailable');
      return Promise.resolve();
    };
    const onError = jest.fn();
    const complete = jest.fn();
    const recording = createDepositRecording({
      isCurrent: () => true,
      onError,
    });
    await recording.start('tx', save, complete);
    expect(recording.getState()?.status).toBe('failed');
    await recording.retry();
    expect(recording.getState()?.status).toBe('succeeded');
    expect(calls).toBe(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('finishes an in-flight save without notifying or retrying a disposed task', async () => {
    let finish: () => void = () => undefined;
    const save = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const complete = jest.fn();
    const onError = jest.fn();
    const recording = createDepositRecording({
      isCurrent: () => true,
      onError,
    });
    const pending = recording.start('tx', save, complete);
    await Promise.resolve();
    recording.deactivate();
    finish();
    await pending;
    await recording.retry();
    expect(save).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
  it('reports both the initial failure and a later retry failure', async () => {
    const error = new OneKeyLocalError('prepare failed');
    const adapter: IDepositTaskAdapter = {
      prepare: async () => {
        throw error;
      },
      confirm: async () => ({ type: 'cancelled' }),
      waitForFinalStatus: async () => 'unknown',
      verify: async () => false,
    };
    const onFail = jest.fn();
    const onTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    await expect(
      runDepositTask({
        task: makeTask(),
        adapter,
        signal: new AbortController().signal,
        isCurrent: () => true,
        onTaskReady,
        onFail,
        formatMessage: (id) => id,
      }),
    ).resolves.toBe(false);
    expect(onFail).toHaveBeenCalledTimes(1);
    await onTaskReady.mock.calls[0][0].retry();
    expect(onFail).toHaveBeenCalledTimes(2);
  });

  it('aborts the current attempt when the parent scope aborts', async () => {
    const abortController = new AbortController();
    let entered: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const adapter: IDepositTaskAdapter = {
      prepare: async ({ signal }) => {
        entered();
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
        return { type: 'cancelled' };
      },
      confirm: async () => ({ type: 'cancelled' }),
      waitForFinalStatus: async () => 'unknown',
      verify: async () => false,
    };
    const onFail = jest.fn();
    const running = runDepositTask({
      task: makeTask(),
      adapter,
      signal: abortController.signal,
      isCurrent: () => true,
      onFail,
      formatMessage: (id) => id,
    });
    await started;
    abortController.abort();
    await expect(running).resolves.toBe(false);
    expect(onFail).not.toHaveBeenCalled();
  });
});
