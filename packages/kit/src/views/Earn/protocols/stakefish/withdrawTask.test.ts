import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IStakeTxResponse } from '@onekeyhq/shared/types/staking';

import { createEarnWithdrawApprovalTask } from '../../tasks/earnWithdrawApprovalTask';
import { createEarnWorkflowTaskController } from '../../tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../tasks/earnWorkflowTaskState';

import {
  createStakefishWithdrawFragment,
  runStakefishWithdrawTask,
} from './withdrawTask';

import type {
  IStakefishWithdrawContext,
  IStakefishWithdrawPrepared,
} from './withdrawTask';

const mockRecordLate = jest.fn(async () => 'synced');
jest.mock('../../tasks/lateEarnOrderRecorder', () => ({
  createLateEarnOrderRecorder: () => mockRecordLate,
}));

type IParams = Parameters<typeof runStakefishWithdrawTask>[0];
const identity = {
  accountId: 'account',
  networkId: 'evm--1',
  provider: 'stakefish',
};
const tx: IStakeTxResponse = {
  tx: { to: 'contract', data: '0x', value: '0' },
  orderId: 'order-1',
};
function setup(ownerKey: string) {
  const onExit = jest.fn();
  const build = jest.fn(async () => tx);
  const navigate: IParams['navigate'] = jest.fn(async () => undefined);
  const params: IParams = {
    taskId: ownerKey,
    identity,
    ownerKey,
    build,
    isExitBroadcast: () => true,
    prepare: async () => ({ encodedTx: 'encoded' }),
    navigate,
    onExit,
    onSubmitted: jest.fn(async () => undefined),
    onObserverError: jest.fn(),
    expiredMessage: 'expired',
    inFlightMessage: 'request pending',
  };
  return { params, build, navigate, onExit };
}

it('signs a full withdrawal inside the task before the external build', async () => {
  const { params } = setup('signed-exit');
  const sequence: string[] = [];
  const signWithdrawal = jest.fn(async () => {
    sequence.push('sign');
    return { signature: 'signed', message: 'message' };
  });
  const build = jest.fn(
    async (_signed?: { signature: string; message: string }) => {
      sequence.push('build');
      return tx;
    },
  );
  const fragment = createStakefishWithdrawFragment({
    ...params,
    signWithdrawal,
    build,
  });
  const task = createEarnWorkflowTask({
    taskId: 'signed-exit',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  await controller.run();
  await expect(fragment.result).resolves.toBe(true);
  expect(sequence).toEqual(['sign', 'build']);
  expect(build).toHaveBeenCalledWith({
    signature: 'signed',
    message: 'message',
  });
  expect(controller.getTask().steps.map(({ id }) => id)).toEqual([
    'signWithdrawal',
    'build',
    'withdraw',
  ]);
  expect(controller.getTask().steps[0].status.type).toBe('completed');
  unsubscribe();
});

it('skips the signing step for a partial withdrawal', async () => {
  const { params } = setup('partial-exit');
  const fragment = createStakefishWithdrawFragment(params);
  const task = createEarnWorkflowTask({
    taskId: 'partial-exit',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  await controller.run();
  await expect(fragment.result).resolves.toBe(true);
  expect(controller.getTask().steps[0].status.type).toBe('skipped');
  unsubscribe();
});

it('does not build an exit after signing is cancelled', async () => {
  const { params, build } = setup('sign-cancelled');
  const fragment = createStakefishWithdrawFragment({
    ...params,
    signWithdrawal: async () => undefined,
  });
  const task = createEarnWorkflowTask({
    taskId: 'sign-cancelled',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  await controller.run();
  await expect(fragment.result).resolves.toBe(false);
  expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  expect(build).not.toHaveBeenCalled();
});

it('does not build an exit when the page closes during signing', async () => {
  const { params, build } = setup('sign-page-closed');
  let resolveSign: (value: {
    signature: string;
    message: string;
  }) => void = () => undefined;
  const pending = new Promise<{ signature: string; message: string }>(
    (resolve) => {
      resolveSign = resolve;
    },
  );
  const signWithdrawal = jest.fn(() => pending);
  const fragment = createStakefishWithdrawFragment({
    ...params,
    signWithdrawal,
  });
  const task = createEarnWorkflowTask({
    taskId: 'sign-page-closed',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  const operation = controller.run();
  await Promise.resolve();
  expect(signWithdrawal).toHaveBeenCalledTimes(1);
  fragment.abortPage();
  await expect(fragment.result).resolves.toBe(false);
  resolveSign({ signature: 'late-signature', message: 'message' });
  await operation;
  expect(build).not.toHaveBeenCalled();
});

it('runs a server-broadcast validator exit as an external task step', async () => {
  const { params, build, navigate, onExit } = setup('exit');
  await expect(runStakefishWithdrawTask(params)).resolves.toBe(true);
  expect(build).toHaveBeenCalledTimes(1);
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
});

it('composes an exit with approval in one controller and reports only after skip commits', async () => {
  const { params } = setup('composed-exit');
  let skipObserved = false;
  let isSkipCommitted = () => false;
  const onExit = jest.fn(() => {
    skipObserved = isSkipCommitted();
  });
  const fragment = createStakefishWithdrawFragment({ ...params, onExit });
  const task = createEarnWorkflowTask({
    taskId: 'composed',
    identity,
    steps: [
      { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
      ...fragment.steps,
    ],
  });
  const controller = createEarnWorkflowTaskController<
    typeof identity,
    IStakefishWithdrawContext,
    IStakefishWithdrawPrepared
  >({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.id !== 'approve'
        ? fragment.getAdapter(step, context)
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            adapter: {
              prepare: async () => ({
                type: 'confirm',
                prepared: { encodedTx: 'approve' },
              }),
              confirm: async ({ onBeforeSend, onSubmitted }) => {
                onBeforeSend();
                onSubmitted('approval-tx');
                return { type: 'submitted' };
              },
              waitForFinalStatus: async () => 'unknown',
              verify: async () => false,
            },
          },
  });
  isSkipCommitted = () =>
    controller
      .getTask()
      .steps.some(
        (step) => step.id === 'withdraw' && step.status.type === 'skipped',
      );
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  await controller.run();
  await expect(fragment.result).resolves.toBe(true);
  unsubscribe();
  expect(skipObserved).toBe(true);
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(controller.getTask().taskId).toBe('composed');
  expect(controller.getTask().steps.map(({ id }) => id)).toEqual([
    'approve',
    'signWithdrawal',
    'build',
    'withdraw',
  ]);
});

it('retains late order recording after the fragment and confirmation are cancelled', async () => {
  mockRecordLate.mockClear();
  const { params } = setup('composed-late');
  let confirmation: Parameters<IParams['navigate']>[0] | undefined;
  const fragment = createStakefishWithdrawFragment({
    ...params,
    isExitBroadcast: () => false,
    navigate: async (value) => {
      confirmation = value;
    },
  });
  const task = createEarnWorkflowTask({
    taskId: 'composed-late',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  await controller.run();
  await expect(fragment.result).resolves.toBe(true);
  await confirmation?.onBeforeSend?.();
  confirmation?.onCancel?.();
  controller.cancel();
  fragment.cancel();
  await confirmation?.onLateBroadcastAccepted?.({
    uuid: 'request',
    accountId: identity.accountId,
    networkId: identity.networkId,
    txid: 'late-tx',
  });
  expect(mockRecordLate).toHaveBeenCalledTimes(1);
  expect(params.onSubmitted).not.toHaveBeenCalled();
  unsubscribe();
});

it('requires an owner to observe the committed skip before reporting the exit', async () => {
  const { params, onExit } = setup('unobserved-exit');
  const fragment = createStakefishWithdrawFragment(params);
  const task = createEarnWorkflowTask({
    taskId: 'unobserved',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  await controller.run();
  expect(onExit).not.toHaveBeenCalled();
  fragment.observeTask(controller.getTask());
  await expect(fragment.result).resolves.toBe(true);
  expect(onExit).toHaveBeenCalledTimes(1);
});

it('preserves a reported exit when the exit callback synchronously aborts its owner', async () => {
  const { params } = setup('exit-aborts-owner');
  const abort = new AbortController();
  const onExit = jest.fn(() => abort.abort());
  await expect(
    runStakefishWithdrawTask({ ...params, signal: abort.signal, onExit }),
  ).resolves.toBe(true);
  expect(onExit).toHaveBeenCalledTimes(1);
});

it('propagates a synchronous exit callback error after the external operation', async () => {
  const { params, build } = setup('exit-callback-error');
  const error = new OneKeyLocalError('exit callback failed');
  await expect(
    runStakefishWithdrawTask({
      ...params,
      onExit: () => {
        throw error;
      },
    }),
  ).rejects.toBe(error);
  expect(build).toHaveBeenCalledTimes(1);
});

it('propagates the exit callback error when that callback also aborts its owner', async () => {
  const { params, build } = setup('exit-abort-and-error');
  const abort = new AbortController();
  const error = new OneKeyLocalError('exit callback failed');
  await expect(
    runStakefishWithdrawTask({
      ...params,
      signal: abort.signal,
      onExit: () => {
        abort.abort();
        throw error;
      },
    }),
  ).rejects.toBe(error);
  expect(build).toHaveBeenCalledTimes(1);
});

it('does not notify an owner that expires while the external exit is pending', async () => {
  const { params, build, onExit } = setup('stale-exit');
  let resolve: (value: IStakeTxResponse) => void = () => undefined;
  let started: () => void = () => undefined;
  const pending = new Promise<IStakeTxResponse>((done) => {
    resolve = done;
  });
  const waiting = new Promise<void>((done) => {
    started = done;
  });
  let current = true;
  build.mockImplementationOnce(async () => {
    started();
    return pending;
  });
  const result = runStakefishWithdrawTask({
    ...params,
    isActionCurrent: () => current,
  });
  await waiting;
  current = false;
  resolve(tx);
  await expect(result).resolves.toBe(false);
  expect(onExit).not.toHaveBeenCalled();
  expect(build).toHaveBeenCalledTimes(1);
});

it('retains a late accepted external exit without reporting it to a cancelled owner', async () => {
  const { params, build, onExit } = setup('late-external');
  let resolve: (value: IStakeTxResponse) => void = () => undefined;
  let started: () => void = () => undefined;
  const pending = new Promise<IStakeTxResponse>((done) => {
    resolve = done;
  });
  const waiting = new Promise<void>((done) => {
    started = done;
  });
  build.mockImplementationOnce(async () => {
    started();
    return pending;
  });
  const fragment = createStakefishWithdrawFragment(params);
  const task = createEarnWorkflowTask({
    taskId: 'late-external',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  const operation = controller.run();
  await waiting;
  controller.cancel();
  fragment.cancel();
  resolve(tx);
  await operation;
  await expect(fragment.result).resolves.toBe(false);
  expect(
    controller.getTask().steps.find((step) => step.id === 'build')?.status.type,
  ).toBe('completed');
  expect(onExit).not.toHaveBeenCalled();
  expect(build).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it('propagates a late external build rejection after an abort in the standalone task', async () => {
  const { params, build, onExit } = setup('aborted-external-error');
  const abort = new AbortController();
  let reject: (error: Error) => void = () => undefined;
  let started: () => void = () => undefined;
  const pending = new Promise<IStakeTxResponse>((_resolve, fail) => {
    reject = fail;
  });
  const waiting = new Promise<void>((done) => {
    started = done;
  });
  build.mockImplementationOnce(async () => {
    started();
    return pending;
  });
  const result = runStakefishWithdrawTask({ ...params, signal: abort.signal });
  await waiting;
  abort.abort();
  const error = new OneKeyLocalError('late external failure');
  reject(error);
  await expect(result).rejects.toBe(error);
  expect(onExit).not.toHaveBeenCalled();
  expect(build).toHaveBeenCalledTimes(1);
});

it('keeps the fragment result pending after cancellation until its external build rejects', async () => {
  const { params, build } = setup('fragment-cancel-pending');
  let reject: (error: Error) => void = () => undefined;
  let started: () => void = () => undefined;
  const pending = new Promise<IStakeTxResponse>((_resolve, fail) => {
    reject = fail;
  });
  const waiting = new Promise<void>((done) => {
    started = done;
  });
  build.mockImplementationOnce(async () => {
    started();
    return pending;
  });
  const fragment = createStakefishWithdrawFragment(params);
  const task = createEarnWorkflowTask({
    taskId: 'fragment-cancel-pending',
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: fragment.initialContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: fragment.getAdapter,
  });
  const operation = controller.run();
  await waiting;
  controller.cancel();
  fragment.cancel();
  let settled = false;
  void fragment.result.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await Promise.resolve();
  expect(settled).toBe(false);
  const error = new OneKeyLocalError('external request failed');
  const operationOutcome = operation.then(
    () => undefined,
    (failure: unknown) => failure,
  );
  const fragmentOutcome = fragment.result.then(
    () => undefined,
    (failure: unknown) => failure,
  );
  reject(error);
  expect(await operationOutcome).toBe(error);
  expect(await fragmentOutcome).toBe(error);
});

it.each([false, true])(
  'runs Stakefish through the real approval workflow (exit=%s)',
  async (exit) => {
    const { params, build, onExit, navigate } = setup(
      `approval-fragment-exit-${String(exit)}`,
    );
    const workflowIdentity = {
      ...identity,
      accountAddress: '0x123',
      action: 'withdraw' as const,
    };
    const events: string[] = [];
    const fragment = createStakefishWithdrawFragment({
      ...params,
      identity: workflowIdentity,
      isExitBroadcast: () => exit,
      signWithdrawal: async () => {
        events.push('sign');
        return { signature: 'signature', message: 'message' };
      },
    });
    const workflow = createEarnWithdrawApprovalTask<
      string,
      IStakefishWithdrawPrepared,
      IStakefishWithdrawContext
    >({
      taskId: 'approval-fragment-exit',
      identity: workflowIdentity,
      protocolSteps: fragment.steps,
      initialContext: fragment.initialContext,
      approval: {
        handoffOnSubmit: true,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            events.push('approve');
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
      },
      allowanceCheck: async () => {
        events.push('allowance');
        return true;
      },
      prepareBusiness: async (handoff) => {
        await handoff.register({ ...fragment, identity: workflowIdentity });
      },
      isCurrent: () => true,
      onAsyncError: jest.fn(),
    });
    await expect(workflow.run()).resolves.toBe(true);
    expect(events).toEqual(['approve', 'allowance', 'sign']);
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith({
      signature: 'signature',
      message: 'message',
    });
    expect(onExit).toHaveBeenCalledTimes(exit ? 1 : 0);
    expect(navigate).toHaveBeenCalledTimes(exit ? 0 : 1);
    expect(workflow.getTask().taskId).toBe('approval-fragment-exit');
    expect(workflow.getTask().steps.map(({ id }) => id)).toEqual([
      'approve',
      'allowance',
      'prepareBusiness',
      'signWithdrawal',
      'build',
      'withdraw',
    ]);
  },
);

it.each([false, true])(
  'preserves the broadcast exit outcome when onExit aborts and throws=%s',
  async (throws) => {
    const { params, build } = setup('approval-exit-abort');
    const abort = new AbortController();
    const workflowIdentity = {
      ...identity,
      accountAddress: '0x123',
      action: 'withdraw' as const,
    };
    const error = new OneKeyLocalError('exit callback failed');
    const onExit = jest.fn(() => {
      abort.abort();
      if (throws) throw error;
    });
    const fragment = createStakefishWithdrawFragment({
      ...params,
      identity: workflowIdentity,
      signal: abort.signal,
      onExit,
    });
    const workflow = createEarnWithdrawApprovalTask<
      string,
      IStakefishWithdrawPrepared,
      IStakefishWithdrawContext
    >({
      taskId: 'approval-exit-abort',
      identity: workflowIdentity,
      protocolSteps: fragment.steps,
      initialContext: fragment.initialContext,
      approval: {
        handoffOnSubmit: true,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (handoff) => {
        const abortPage = () => fragment.abortPage();
        abort.signal.addEventListener('abort', abortPage, { once: true });
        try {
          await handoff.register({ ...fragment, identity: workflowIdentity });
        } finally {
          abort.signal.removeEventListener('abort', abortPage);
        }
      },
      isCurrent: () => true,
      signal: abort.signal,
      onAsyncError: jest.fn(),
    });
    if (throws) await expect(workflow.run()).rejects.toBe(error);
    else await expect(workflow.run()).resolves.toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledTimes(1);
    expect(
      workflow.getTask().steps.find((step) => step.id === 'build')?.status.type,
    ).toBe('completed');
  },
);

it('propagates a late external rejection after the real approval workflow is cancelled', async () => {
  const { params, build, onExit } = setup('approval-fragment-cancel');
  let reject: (error: Error) => void = () => undefined;
  let started: () => void = () => undefined;
  const pending = new Promise<IStakeTxResponse>((_resolve, fail) => {
    reject = fail;
  });
  const waiting = new Promise<void>((done) => {
    started = done;
  });
  build.mockImplementationOnce(async () => {
    started();
    return pending;
  });
  const workflowIdentity = {
    ...identity,
    accountAddress: '0x123',
    action: 'withdraw' as const,
  };
  const fragment = createStakefishWithdrawFragment({
    ...params,
    identity: workflowIdentity,
  });
  const workflow = createEarnWithdrawApprovalTask<
    string,
    IStakefishWithdrawPrepared,
    IStakefishWithdrawContext
  >({
    taskId: 'approval-fragment-cancel',
    identity: workflowIdentity,
    protocolSteps: fragment.steps,
    initialContext: fragment.initialContext,
    approval: {
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('approval-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
    },
    allowanceCheck: async () => true,
    prepareBusiness: async (handoff) => {
      await handoff.register({ ...fragment, identity: workflowIdentity });
    },
    isCurrent: () => true,
    onAsyncError: jest.fn(),
  });
  const result = workflow.run();
  await waiting;
  workflow.cancel();
  let settled = false;
  void result.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await Promise.resolve();
  expect(settled).toBe(false);
  const error = new OneKeyLocalError('late external rejection');
  reject(error);
  await expect(result).rejects.toBe(error);
  expect(build).toHaveBeenCalledTimes(1);
  expect(onExit).not.toHaveBeenCalled();
});

it('reports a late encoding rejection after the real approval workflow is cancelled', async () => {
  const { params, build } = setup('approval-encoding-cancel');
  const workflowIdentity = {
    ...identity,
    accountAddress: '0x123',
    action: 'withdraw' as const,
  };
  let rejectPrepare: (error: Error) => void = () => undefined;
  let markPreparing: () => void = () => undefined;
  let report: (error: unknown) => void = () => undefined;
  const preparation = new Promise<IStakefishWithdrawPrepared>(
    (_resolve, reject) => {
      rejectPrepare = reject;
    },
  );
  const preparing = new Promise<void>((resolve) => {
    markPreparing = resolve;
  });
  const reported = new Promise<unknown>((resolve) => {
    report = resolve;
  });
  const onAsyncError = jest.fn((error: unknown) => report(error));
  const fragment = createStakefishWithdrawFragment({
    ...params,
    identity: workflowIdentity,
    isExitBroadcast: () => false,
    prepare: async () => {
      markPreparing();
      return preparation;
    },
  });
  const workflow = createEarnWithdrawApprovalTask<
    string,
    IStakefishWithdrawPrepared,
    IStakefishWithdrawContext
  >({
    taskId: 'approval-encoding-cancel',
    identity: workflowIdentity,
    protocolSteps: fragment.steps,
    initialContext: fragment.initialContext,
    approval: {
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('approval-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
    },
    allowanceCheck: async () => true,
    prepareBusiness: async (handoff) => {
      await handoff.register({ ...fragment, identity: workflowIdentity });
    },
    isCurrent: () => true,
    onAsyncError,
  });
  const result = workflow.run();
  await preparing;
  workflow.cancel();
  await expect(result).resolves.toBe(false);
  const error = new OneKeyLocalError('late encoding failure');
  rejectPrepare(error);
  await expect(reported).resolves.toBe(error);
  expect(onAsyncError).toHaveBeenCalledTimes(1);
  expect(build).toHaveBeenCalledTimes(1);
  expect(params.navigate).not.toHaveBeenCalled();
});

it('records a late Stakefish transaction after cancellation of the real approval workflow', async () => {
  mockRecordLate.mockClear();
  const { params } = setup('approval-fragment-late');
  const workflowIdentity = {
    ...identity,
    accountAddress: '0x123',
    action: 'withdraw' as const,
  };
  let confirmation: Parameters<IParams['navigate']>[0] | undefined;
  const fragment = createStakefishWithdrawFragment({
    ...params,
    identity: workflowIdentity,
    isExitBroadcast: () => false,
    navigate: async (value) => {
      confirmation = value;
    },
  });
  const workflow = createEarnWithdrawApprovalTask<
    string,
    IStakefishWithdrawPrepared,
    IStakefishWithdrawContext
  >({
    taskId: 'approval-fragment-late',
    identity: workflowIdentity,
    protocolSteps: fragment.steps,
    initialContext: fragment.initialContext,
    approval: {
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('approval-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
    },
    allowanceCheck: async () => true,
    prepareBusiness: async (handoff) => {
      await handoff.register({ ...fragment, identity: workflowIdentity });
    },
    isCurrent: () => true,
    onAsyncError: jest.fn(),
  });
  await expect(workflow.run()).resolves.toBe(true);
  await confirmation?.onBeforeSend?.();
  confirmation?.onCancel?.();
  workflow.cancel();
  await confirmation?.onLateBroadcastAccepted?.({
    uuid: 'late-request',
    accountId: identity.accountId,
    networkId: identity.networkId,
    txid: 'late-tx',
  });
  expect(mockRecordLate).toHaveBeenCalledTimes(1);
  expect(params.onSubmitted).not.toHaveBeenCalled();
});

it('does not start another exit request while the first remains in flight', async () => {
  const { params, build } = setup('inflight');
  let resolve: (value: IStakeTxResponse) => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((done) => {
    markStarted = done;
  });
  const pending = new Promise<IStakeTxResponse>((done) => {
    resolve = done;
  });
  build.mockImplementationOnce(async () => {
    markStarted();
    return pending;
  });
  const first = runStakefishWithdrawTask(params);
  await started;
  await expect(runStakefishWithdrawTask(params)).rejects.toThrow(
    'request pending',
  );
  expect(build).toHaveBeenCalledTimes(1);
  resolve(tx);
  await expect(first).resolves.toBe(true);
});

it('does not repeat an exit request whose server result is unknown', async () => {
  const { params, build } = setup('unknown');
  build.mockRejectedValueOnce(new OneKeyLocalError('transport failed'));
  await expect(runStakefishWithdrawTask(params)).rejects.toThrow(
    'transport failed',
  );
  expect(build).toHaveBeenCalledTimes(1);
});

it('hands an ordinary Stakefish transaction to the normal confirmation', async () => {
  const { params, navigate, onExit } = setup('transaction');
  await expect(
    runStakefishWithdrawTask({ ...params, isExitBroadcast: () => false }),
  ).resolves.toBe(true);
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(onExit).not.toHaveBeenCalled();
});

it('rechecks the form scope after the navigation handoff outcome', async () => {
  const { params } = setup('handoff-scope-checks');
  let navigationReturned = false;
  let postNavigationChecks = 0;
  let current = true;
  const result = await runStakefishWithdrawTask({
    ...params,
    isExitBroadcast: () => false,
    navigate: async () => {
      navigationReturned = true;
    },
    isActionCurrent: () => {
      if (navigationReturned) {
        postNavigationChecks += 1;
        if (postNavigationChecks === 4)
          queueMicrotask(() => {
            current = false;
          });
      }
      return current;
    },
  });
  expect(result).toBe(false);
});

it('uses the send owner after confirmation handoff even if the form aborts', async () => {
  const { params } = setup('handoff');
  const abort = new AbortController();
  let confirmation: Parameters<IParams['navigate']>[0] | undefined;
  const navigate: IParams['navigate'] = async (value) => {
    confirmation = value;
  };
  await expect(
    runStakefishWithdrawTask({
      ...params,
      isExitBroadcast: () => false,
      isSendCurrent: () => true,
      signal: abort.signal,
      navigate,
    }),
  ).resolves.toBe(true);
  abort.abort();
  expect(() => confirmation?.onBeforeSend?.()).not.toThrow();
});

it.each(['prepare', 'navigate'] as const)(
  'propagates a %s failure without starting another request',
  async (stage) => {
    const { params, build } = setup(stage);
    const failure = new OneKeyLocalError(`${stage} failed`);
    await expect(
      runStakefishWithdrawTask({
        ...params,
        isExitBroadcast: () => false,
        ...(stage === 'prepare'
          ? {
              prepare: async () => {
                throw failure;
              },
            }
          : {
              navigate: async () => {
                throw failure;
              },
            }),
      }),
    ).rejects.toBe(failure);
    expect(build).toHaveBeenCalledTimes(1);
  },
);

it.each(['resolve', 'reject'] as const)(
  'preserves a %s while the ordinary transaction scope expires',
  async (outcome) => {
    const { params, navigate } = setup(`stale-${outcome}`);
    let current = true;
    let finish: (value: { encodedTx: string }) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    let started: () => void = () => undefined;
    const pending = new Promise<{ encodedTx: string }>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    const preparing = new Promise<void>((resolve) => {
      started = resolve;
    });
    const operation = runStakefishWithdrawTask({
      ...params,
      isExitBroadcast: () => false,
      isActionCurrent: () => current,
      prepare: async () => {
        started();
        return pending;
      },
    });
    await preparing;
    current = false;
    if (outcome === 'reject') {
      const error = new OneKeyLocalError('encoding failed');
      fail(error);
      await expect(operation).rejects.toBe(error);
    } else {
      finish({ encodedTx: 'encoded' });
      await expect(operation).resolves.toBe(false);
    }
    expect(navigate).not.toHaveBeenCalled();
  },
);

it('settles a composed Stakefish task when only its page aborts during navigation', async () => {
  mockRecordLate.mockClear();
  const { params } = setup('page-navigation');
  let confirmation: Parameters<IParams['navigate']>[0] | undefined;
  const page = new AbortController();
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<void>(() => undefined);
  const workflowIdentity = {
    ...identity,
    accountAddress: '0x123',
    action: 'withdraw' as const,
  };
  const fragment = createStakefishWithdrawFragment({
    ...params,
    identity: workflowIdentity,
    signal: page.signal,
    isExitBroadcast: () => false,
    navigate: async (value) => {
      confirmation = value;
      markStarted();
      await pending;
    },
  });
  const workflow = createEarnWithdrawApprovalTask<
    string,
    IStakefishWithdrawPrepared,
    IStakefishWithdrawContext
  >({
    taskId: 'page-navigation',
    identity: workflowIdentity,
    protocolSteps: fragment.steps,
    initialContext: fragment.initialContext,
    approval: {
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('approval-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
    },
    allowanceCheck: async () => true,
    prepareBusiness: async (handoff) => {
      const abortPage = () => fragment.abortPage();
      page.signal.addEventListener('abort', abortPage, { once: true });
      try {
        await handoff.register({ ...fragment, identity: workflowIdentity });
      } finally {
        page.signal.removeEventListener('abort', abortPage);
      }
    },
    isCurrent: () => true,
    onAsyncError: jest.fn(),
  });
  const result = workflow.run();
  await started;
  await confirmation?.onBeforeSend?.();
  page.abort();
  await expect(result).resolves.toBe(false);
  await confirmation?.onLateBroadcastAccepted?.({
    uuid: 'page-late',
    accountId: identity.accountId,
    networkId: identity.networkId,
    txid: 'late-tx',
  });
  expect(mockRecordLate).toHaveBeenCalledTimes(1);
});

it.each(['resolve', 'reject'] as const)(
  'waits for a Stakefish external build after page abort and preserves its %s',
  async (outcome) => {
    const { params, onExit } = setup(`page-build-${outcome}`);
    const page = new AbortController();
    let finish: (value: IStakeTxResponse) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const pending = new Promise<IStakeTxResponse>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    const build = jest.fn(() => {
      markStarted();
      return pending;
    });
    const prepare = jest.fn(params.prepare);
    const workflowIdentity = {
      ...identity,
      accountAddress: '0x123',
      action: 'withdraw' as const,
    };
    const fragment = createStakefishWithdrawFragment({
      ...params,
      identity: workflowIdentity,
      signal: page.signal,
      build,
      prepare,
      isExitBroadcast: () => false,
    });
    const workflow = createEarnWithdrawApprovalTask<
      string,
      IStakefishWithdrawPrepared,
      IStakefishWithdrawContext
    >({
      taskId: 'page-build',
      identity: workflowIdentity,
      protocolSteps: fragment.steps,
      initialContext: fragment.initialContext,
      approval: {
        handoffOnSubmit: true,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (handoff) => {
        const abortPage = () => fragment.abortPage();
        page.signal.addEventListener('abort', abortPage, { once: true });
        try {
          await handoff.register({ ...fragment, identity: workflowIdentity });
        } finally {
          page.signal.removeEventListener('abort', abortPage);
        }
      },
      isCurrent: () => true,
      onAsyncError: jest.fn(),
    });
    let settled = false;
    const result = workflow.run().then(
      (value) => {
        settled = true;
        return { value };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      },
    );
    await started;
    page.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    if (outcome === 'reject') {
      const error = new OneKeyLocalError('external build failed');
      fail(error);
      await expect(result).resolves.toEqual({ error });
    } else {
      finish(tx);
      await expect(result).resolves.toEqual({ value: false });
    }
    expect(prepare).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  },
);

it.each(['resolve', 'reject'] as const)(
  'waits for Stakefish encoding after page abort and preserves its %s',
  async (outcome) => {
    const { params, navigate } = setup(`page-prepare-${outcome}`);
    const page = new AbortController();
    let finish: (value: IStakefishWithdrawPrepared) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const pending = new Promise<IStakefishWithdrawPrepared>(
      (resolve, reject) => {
        finish = resolve;
        fail = reject;
      },
    );
    const workflowIdentity = {
      ...identity,
      accountAddress: '0x123',
      action: 'withdraw' as const,
    };
    const fragment = createStakefishWithdrawFragment({
      ...params,
      identity: workflowIdentity,
      signal: page.signal,
      isExitBroadcast: () => false,
      prepare: () => {
        markStarted();
        return pending;
      },
    });
    const workflow = createEarnWithdrawApprovalTask<
      string,
      IStakefishWithdrawPrepared,
      IStakefishWithdrawContext
    >({
      taskId: 'page-prepare',
      identity: workflowIdentity,
      protocolSteps: fragment.steps,
      initialContext: fragment.initialContext,
      approval: {
        handoffOnSubmit: true,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (handoff) => {
        const abortPage = () => fragment.abortPage();
        page.signal.addEventListener('abort', abortPage, { once: true });
        try {
          await handoff.register({ ...fragment, identity: workflowIdentity });
        } finally {
          page.signal.removeEventListener('abort', abortPage);
        }
      },
      isCurrent: () => true,
      onAsyncError: jest.fn(),
    });
    let settled = false;
    const result = workflow.run().then(
      (value) => {
        settled = true;
        return { value };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      },
    );
    await started;
    page.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    if (outcome === 'reject') {
      const error = new OneKeyLocalError('encoding failed');
      fail(error);
      await expect(result).resolves.toEqual({ error });
    } else {
      finish({ encodedTx: 'encoded' });
      await expect(result).resolves.toEqual({ value: false });
    }
    expect(navigate).not.toHaveBeenCalled();
  },
);
