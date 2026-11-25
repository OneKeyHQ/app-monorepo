import { createEarnConfirmationTaskAdapter } from './confirmationTaskAdapter';
import { createEarnSingleTransactionTaskState } from './singleTransactionTaskState';
import { createEarnTransactionTaskController } from './transactionTaskController';

import type { IEarnTransactionStepStatus } from './transactionStep';
import type {
  IEarnTransactionTaskAdapter,
  IEarnTransactionTaskPreparation,
} from './transactionTaskController';

type IStep = {
  id: string;
  kind: 'protocol';
  attemptId?: string;
  status: IEarnTransactionStepStatus;
};
type ITask = {
  taskId: string;
  identity: { accountId: string };
  steps: IStep[];
  currentStepIndex: number;
};
type IPreparation = IEarnTransactionTaskPreparation<void, never>;
type IAdapter = IEarnTransactionTaskAdapter<
  ITask['identity'],
  IStep,
  void,
  IPreparation
>;
type IConfirmContext = Parameters<IAdapter['confirm']>[0];

function createHarness(confirmOrAdapter: IAdapter['confirm'] | IAdapter) {
  let current = true;
  const state = createEarnSingleTransactionTaskState({
    taskId: 'task',
    identity: {
      accountId: 'account',
      networkId: 'evm--1',
      provider: 'provider',
    },
    step: { id: 'protocol', kind: 'protocol' as const },
    lateSubmitted: 'confirming',
  });
  const onChange = jest.fn();
  const onStaleChange = jest.fn();
  const controller = createEarnTransactionTaskController<
    ITask['identity'],
    IStep,
    ITask,
    void,
    never,
    IPreparation
  >({
    state,
    adapter:
      typeof confirmOrAdapter === 'function'
        ? {
            confirmationLifecycle: 'detached',
            prepare: async () => ({ type: 'confirm', prepared: undefined }),
            confirm: confirmOrAdapter,
            waitForFinalStatus: async () => 'unknown',
            verify: async () => false,
          }
        : confirmOrAdapter,
    normalizePreparation: (value) => value,
    shouldHandoffOnSubmit: () => true,
    isCurrent: () => current,
    onChange,
    onStaleChange,
    expiredMessage: 'expired',
  });
  return {
    controller,
    state,
    onChange,
    onStaleChange,
    subscribe: state.subscribe,
    setCurrent: (value: boolean) => {
      current = value;
    },
  };
}

test('navigation handoff stays awaiting user until the later transaction callback', async () => {
  let events: IConfirmContext | undefined;
  const { controller, onChange, onStaleChange } = createHarness(
    async (context) => {
      events = context;
      return { type: 'detached' };
    },
  );
  await controller.run();
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'awaitingUser',
  });
  expect(events?.onSubmitted('tx')).toBe(true);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'tx',
  });
  expect(onChange).toHaveBeenLastCalledWith(controller.getTask());
  expect(onStaleChange).not.toHaveBeenCalled();
});

test('a verified late broadcast records the original attempt without handing off', async () => {
  let events: IConfirmContext | undefined;
  const { controller } = createHarness(async (context) => {
    events = context;
    return { type: 'detached' };
  });
  await controller.run();
  events?.onConfirmationCancelled('beforeSend');
  expect(events?.onLateBroadcastAccepted('late-tx')).toBe(true);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    txid: 'late-tx',
    chainConfirmed: false,
  });
});

test('late broadcast facts from an old attempt cannot change the current attempt', async () => {
  const callbacks: IConfirmContext[] = [];
  const { controller } = createHarness(async (context) => {
    callbacks.push(context);
    return { type: 'detached' };
  });
  await controller.run();
  callbacks[0].onConfirmationCancelled('beforeSend');
  await controller.retry();
  expect(callbacks[0].onLateBroadcastAccepted('old-tx')).toBe(false);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'awaitingUser',
  });
});

test('conflicting late broadcast facts are retained as an unknown outcome', async () => {
  let events: IConfirmContext | undefined;
  const { controller } = createHarness(async (context) => {
    events = context;
    return { type: 'detached' };
  });
  await controller.run();
  events?.onConfirmationCancelled('unknown');
  expect(events?.onLateBroadcastAccepted('tx-1')).toBe(true);
  expect(events?.onLateBroadcastAccepted('tx-2')).toBe(false);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
    txidConflict: ['tx-1', 'tx-2'],
  });
});

test('a late success after cancellation cannot hand off the original attempt', async () => {
  let events: IConfirmContext | undefined;
  const { controller } = createHarness(async (context) => {
    events = context;
    return { type: 'detached' };
  });
  await controller.run();
  events?.onConfirmationCancelled('unknown');
  expect(events?.onSubmitted('late-tx')).toBe(true);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    txid: 'late-tx',
    chainConfirmed: false,
  });
});

test('cancellation before navigation starts is known not to have sent', async () => {
  const confirm = jest.fn(async (_context: IConfirmContext) => ({
    type: 'detached' as const,
  }));
  const { controller, subscribe } = createHarness(confirm);
  subscribe(() => {
    if (controller.getTask().steps[0].status.type === 'awaitingUser') {
      controller.cancel();
    }
  });
  await controller.run();
  expect(confirm).not.toHaveBeenCalled();
  expect(controller.getTask().steps[0].status).toEqual({ type: 'cancelled' });
});

test('synchronous navigation failure is retained when navigation later resolves', async () => {
  const { controller } = createHarness(async ({ onConfirmationFailed }) => {
    onConfirmationFailed('beforeSend');
    return { type: 'detached' };
  });
  await controller.run();
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'failed',
    stage: 'beforeSend',
  });
});

test('later uncertain cancellation accepts a late transaction id without another send', async () => {
  let events: IConfirmContext | undefined;
  const { controller } = createHarness(async (context) => {
    events = context;
    return { type: 'detached' };
  });
  await controller.run();
  events?.onConfirmationCancelled('unknown');
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
  expect(events?.onSubmitted('late-tx')).toBe(true);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    txid: 'late-tx',
    chainConfirmed: false,
  });
});

test('a scope change after handoff retains unknown and accepts a late transaction id', async () => {
  let events: IConfirmContext | undefined;
  const { controller, setCurrent, onStaleChange } = createHarness(
    async (context) => {
      events = context;
      return { type: 'detached' };
    },
  );
  await controller.run();
  setCurrent(false);
  controller.cancel();
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
  expect(events?.onSubmitted('late-tx')).toBe(true);
  expect(onStaleChange).toHaveBeenCalled();
});

test('success without an id remains unknown', async () => {
  let events: IConfirmContext | undefined;
  const { controller } = createHarness(async (context) => {
    events = context;
    return { type: 'detached' };
  });
  await controller.run();
  expect(events?.onSubmitted('')).toBe(false);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
});

test('old attempt events do not mutate a new attempt', async () => {
  const callbacks: IConfirmContext[] = [];
  const { controller } = createHarness(async (context) => {
    callbacks.push(context);
    return { type: 'detached' };
  });
  await controller.run();
  callbacks[0].onConfirmationCancelled('beforeSend');
  await controller.retry();
  callbacks[0].onSubmitted('old-tx');
  callbacks[0].onConfirmationFailed('unknown');
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'awaitingUser',
  });
  expect(callbacks[1].onSubmitted('new-tx')).toBe(true);
});

test('observing a send does not guard or claim a submission', async () => {
  let events: IConfirmContext | undefined;
  const { controller } = createHarness(async (context) => {
    events = context;
    return { type: 'detached' };
  });
  await controller.run();
  events?.onSendObserved();
  expect(controller.getTask().steps[0].status).toEqual({ type: 'sending' });
  controller.cancel();
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
  expect(events?.onSubmitted('late-tx')).toBe(true);
});

test('cancellation while navigation is unresolved does not claim the transaction was not sent', async () => {
  let events: IConfirmContext | undefined;
  let resolveNavigation: (() => void) | undefined;
  const navigation = new Promise<void>((resolve) => {
    resolveNavigation = resolve;
  });
  const { controller } = createHarness(async (context) => {
    events = context;
    await navigation;
    return { type: 'detached' };
  });
  const run = controller.run();
  await Promise.resolve();
  controller.cancel();
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
  resolveNavigation?.();
  await run;
  expect(events?.onSubmitted('late-tx')).toBe(true);
});

test('a confirmed pre-send cancellation stays cancellable', async () => {
  let events: IConfirmContext | undefined;
  const { controller } = createHarness(async (context) => {
    events = context;
    return { type: 'detached' };
  });
  await controller.run();
  events?.onConfirmationCancelled('beforeSend');
  expect(controller.getTask().steps[0].status).toEqual({ type: 'cancelled' });
});

test('a success callback can arrive synchronously before navigation returns', async () => {
  const { controller } = createHarness(async ({ onSubmitted }) => {
    expect(onSubmitted('tx')).toBe(true);
    return { type: 'detached' };
  });
  await controller.run();
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'tx',
  });
});

type IResult = { txid?: string };
type INavigationCallbacks = {
  onSuccess: (data: IResult) => void | Promise<void>;
  onFail: (error: Error) => void;
  onCancel: () => void;
  onSendObserved: () => void;
};

function createConfirmationAdapter({
  navigate,
  onSuccess,
  onFail,
  onObserverError,
}: {
  navigate: (callbacks: INavigationCallbacks) => Promise<void>;
  onSuccess?: (data: IResult) => void | Promise<void>;
  onFail?: (error: Error) => void;
  onObserverError?: (error: unknown) => void;
}) {
  return createEarnConfirmationTaskAdapter<
    ITask['identity'],
    IStep,
    void,
    IResult,
    Error
  >({
    prepare: async () => undefined,
    navigate: async (_payload, callbacks) => navigate(callbacks),
    onSuccess,
    onFail,
    onObserverError: onObserverError ?? jest.fn(),
    getTxid: (data) => data.txid,
    failureCertainty: () => 'beforeSend',
    cancellationCertainty: () => 'unknown',
  });
}

test('adapter navigation resolves before later order recording and original success callback', async () => {
  let callbacks: INavigationCallbacks | undefined;
  const calls: string[] = [];
  const { adapter, start } = createConfirmationAdapter({
    navigate: async (value) => {
      callbacks = value;
    },
    onSuccess: async () => {
      calls.push('record-start');
      await Promise.resolve();
      calls.push('record-finished');
      calls.push('user-success');
    },
  });
  const { controller } = createHarness(adapter);
  await expect(start(controller.run)).resolves.toBe('finished');
  expect(calls).toEqual([]);
  expect(controller.getTask().steps[0].status.type).toBe('awaitingUser');
  await callbacks?.onSuccess({ txid: 'tx' });
  expect(calls).toEqual(['record-start', 'record-finished', 'user-success']);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'tx',
  });
});

test('adapter reports synchronous navigation failure while navigation still resolves', async () => {
  const failure = new Error('prepare failed');
  const onFail = jest.fn();
  const { adapter, navigation } = createConfirmationAdapter({
    navigate: async (callbacks) => {
      callbacks.onFail(failure);
    },
    onFail,
  });
  const { controller } = createHarness(adapter);
  const run = controller.run();
  await expect(navigation).resolves.toBe('finished');
  await run;
  expect(onFail).toHaveBeenCalledWith(failure, undefined);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'failed',
    stage: 'beforeSend',
  });
});

test('adapter preserves a later original callback rejection and records its txid', async () => {
  let callbacks: INavigationCallbacks | undefined;
  const failure = new Error('order recording failed');
  const onSuccess = jest.fn(async () => {
    throw failure;
  });
  const { adapter, navigation } = createConfirmationAdapter({
    navigate: async (value) => {
      callbacks = value;
    },
    onSuccess,
  });
  const { controller } = createHarness(adapter);
  const run = controller.run();
  await navigation;
  await run;
  await expect(callbacks?.onSuccess({ txid: 'tx' })).rejects.toBe(failure);
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'tx',
  });
});

test('adapter rejects navigation when payload preparation fails', async () => {
  const failure = new Error('payload failed');
  const { adapter, navigation } = createEarnConfirmationTaskAdapter<
    ITask['identity'],
    IStep,
    void,
    IResult,
    Error
  >({
    prepare: async () => {
      throw failure;
    },
    navigate: async () => undefined,
    onObserverError: jest.fn(),
    getTxid: (data) => data.txid,
    failureCertainty: () => 'beforeSend',
    cancellationCertainty: () => 'unknown',
  });
  const { controller } = createHarness(adapter);
  const run = controller.run();
  await expect(navigation).rejects.toBe(failure);
  await run;
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'failed',
    stage: 'beforeSend',
  });
});

test('an observer failure is reported without suppressing or replacing the original success rejection', async () => {
  let callbacks: INavigationCallbacks | undefined;
  const observerError = new Error('observer failed');
  const callbackError = new Error('original callback failed');
  const onObserverError = jest.fn();
  const onSuccess = jest.fn(async () => {
    throw callbackError;
  });
  const { adapter, navigation } = createConfirmationAdapter({
    navigate: async (value) => {
      callbacks = value;
    },
    onSuccess,
    onObserverError,
  });
  const { controller, subscribe } = createHarness(adapter);
  const run = controller.run();
  await navigation;
  await run;
  subscribe(() => {
    throw observerError;
  });
  await expect(callbacks?.onSuccess({ txid: 'tx' })).rejects.toBe(
    callbackError,
  );
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(onObserverError).toHaveBeenCalledWith(observerError);
});

test('scope invalidation after payload preparation settles navigation without opening it', async () => {
  let resolvePreparation: (() => void) | undefined;
  const preparation = new Promise<void>((resolve) => {
    resolvePreparation = resolve;
  });
  const navigate = jest.fn(async () => undefined);
  const { adapter, navigation } = createEarnConfirmationTaskAdapter<
    ITask['identity'],
    IStep,
    void,
    IResult,
    Error
  >({
    prepare: async () => preparation,
    navigate,
    onObserverError: jest.fn(),
    getTxid: (data) => data.txid,
    failureCertainty: () => 'beforeSend',
    cancellationCertainty: () => 'unknown',
  });
  const { controller, setCurrent } = createHarness(adapter);
  const run = controller.run();
  setCurrent(false);
  resolvePreparation?.();
  await expect(navigation).resolves.toBe('notStarted');
  await run;
  expect(navigate).not.toHaveBeenCalled();
  expect(controller.getTask().steps[0].status).toEqual({ type: 'cancelled' });
});

test('start settles as notStarted when another owner holds the task lease', async () => {
  const navigate = jest.fn(async () => undefined);
  const { adapter, start } = createConfirmationAdapter({ navigate });
  const { controller, state } = createHarness(adapter);
  const owner = Symbol('other');
  expect(state.acquire(owner)).toBe(true);
  await expect(start(controller.run)).resolves.toBe('notStarted');
  expect(navigate).not.toHaveBeenCalled();
  state.release(owner);
});

test('duplicate start shares the pending navigation and starts the driver once', async () => {
  let resolveNavigation: (() => void) | undefined;
  const navigationPending = new Promise<void>((resolve) => {
    resolveNavigation = resolve;
  });
  const navigate = jest.fn(async () => navigationPending);
  const { adapter, start } = createConfirmationAdapter({ navigate });
  const { controller } = createHarness(adapter);
  const run = jest.fn(controller.run);
  const first = start(run);
  const second = start(run);
  expect(first).toBe(second);
  expect(run).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  resolveNavigation?.();
  await expect(first).resolves.toBe('finished');
  expect(navigate).toHaveBeenCalledTimes(1);
});

test('late success callbacks retain their own prepared order payload', async () => {
  const callbacksByOrder = new Map<string, INavigationCallbacks>();
  const recorded: string[] = [];
  const failures: string[] = [];
  const cancellations: string[] = [];
  const makeTask = (orderId: string) => {
    const { adapter, start } = createEarnConfirmationTaskAdapter<
      ITask['identity'],
      IStep,
      string,
      IResult,
      Error
    >({
      prepare: async () => orderId,
      navigate: async (prepared, callbacks) => {
        callbacksByOrder.set(prepared, callbacks);
      },
      onSuccess: async (data, prepared) => {
        recorded.push(`${prepared}:${data.txid}`);
      },
      onFail: (error, prepared) => {
        failures.push(`${prepared}:${error.message}`);
      },
      onCancel: (prepared) => {
        cancellations.push(prepared);
      },
      onObserverError: jest.fn(),
      getTxid: (data) => data.txid,
      failureCertainty: () => 'beforeSend',
      cancellationCertainty: () => 'unknown',
    });
    const state = createEarnSingleTransactionTaskState({
      taskId: orderId,
      identity: {
        accountId: orderId,
        networkId: 'evm--1',
        provider: 'provider',
      },
      step: { id: 'protocol', kind: 'protocol' as const },
      lateSubmitted: 'confirming',
    });
    const controller = createEarnTransactionTaskController<
      ITask['identity'],
      IStep,
      ITask,
      string,
      never,
      IEarnTransactionTaskPreparation<string, never>
    >({
      state,
      adapter,
      normalizePreparation: (value) => value,
      shouldHandoffOnSubmit: () => true,
      isCurrent: () => true,
      onChange: jest.fn(),
      expiredMessage: 'expired',
    });
    return { start, controller };
  };
  const first = makeTask('order-a');
  const second = makeTask('order-b');
  await first.start(first.controller.run);
  await second.start(second.controller.run);
  await callbacksByOrder.get('order-b')?.onSuccess({ txid: 'tx-b' });
  await callbacksByOrder.get('order-a')?.onSuccess({ txid: 'tx-a' });
  callbacksByOrder.get('order-a')?.onFail(new Error('failed'));
  callbacksByOrder.get('order-b')?.onCancel();
  expect(recorded).toEqual(['order-b:tx-b', 'order-a:tx-a']);
  expect(failures).toEqual(['order-a:failed']);
  expect(cancellations).toEqual(['order-b']);
  expect(first.controller.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'tx-a',
  });
  expect(second.controller.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'tx-b',
  });
});

test('txid extraction error is reported and leaves a successful callback unknown', async () => {
  let callbacks: INavigationCallbacks | undefined;
  const extractionError = new Error('txid extraction failed');
  const onObserverError = jest.fn();
  const onSuccess = jest.fn();
  const { adapter, start } = createEarnConfirmationTaskAdapter<
    ITask['identity'],
    IStep,
    void,
    IResult,
    Error
  >({
    prepare: async () => undefined,
    navigate: async (_prepared, value) => {
      callbacks = value;
    },
    onSuccess,
    onObserverError,
    getTxid: () => {
      throw extractionError;
    },
    failureCertainty: () => 'beforeSend',
    cancellationCertainty: () => 'unknown',
  });
  const { controller } = createHarness(adapter);
  await start(controller.run);
  await callbacks?.onSuccess({ txid: 'tx' });
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(onObserverError).toHaveBeenCalledWith(extractionError);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
});
