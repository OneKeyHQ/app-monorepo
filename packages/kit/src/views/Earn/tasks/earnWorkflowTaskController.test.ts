import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnConfirmationTaskAdapter } from './confirmationTaskAdapter';
import { createEarnWorkflowTaskController } from './earnWorkflowTaskController';
import { createEarnWorkflowTask } from './earnWorkflowTaskState';

const identity = {
  accountId: 'account',
  networkId: 'network',
  provider: 'provider',
};
type ITransactionWorkflowStep = Exclude<
  import('./earnWorkflowTaskState').IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
type IContext = { signature?: string; psbt?: string; txid?: string };

it('retries a cancelled sign step in the same retained task before deposit', async () => {
  let signAttempts = 0;
  const build = jest.fn();
  const task = createEarnWorkflowTask({
    taskId: 'sign-deposit',
    identity,
    steps: [
      { id: 'permit', kind: 'sign' },
      { id: 'deposit', kind: 'deposit', lateSubmitted: 'unknown' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    retained: true,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'sign'
        ? {
            kind: 'sign',
            run: async () => {
              signAttempts += 1;
              return signAttempts === 1
                ? { type: 'cancelled' }
                : {
                    type: 'completed',
                    context: { signature: 'private-permit' },
                  };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            adapter: {
              prepare: async () => {
                build(context.signature);
                return { type: 'confirm', prepared: 'deposit' };
              },
              confirm: async ({ onBeforeSend, onSubmitted }) => {
                onBeforeSend();
                onSubmitted('deposit-tx');
                return { type: 'submitted' };
              },
              waitForFinalStatus: async () => 'success',
              verify: async () => true,
            },
          },
  });
  const owner = controller.attachOwner(() => true);
  await controller.run(owner);
  expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  expect(build).not.toHaveBeenCalled();
  await controller.tryRetrySign(owner);
  expect(build).toHaveBeenCalledWith('private-permit');
  expect(controller.getTask().taskId).toBe('sign-deposit');
  expect(JSON.stringify(controller.getTask())).not.toContain('private-permit');
});

it('runs dynamically inserted approval in the same task before retrying deposit', async () => {
  const sent: string[] = [];
  let depositAttempts = 0;
  const task = createEarnWorkflowTask({
    taskId: 'dynamic-approval',
    identity,
    steps: [
      { id: 'initial-approval', kind: 'approve', lateSubmitted: 'unknown' },
      { id: 'deposit', kind: 'deposit', lateSubmitted: 'confirming' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    retained: true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step) => ({
      kind: 'transaction',
      handoffOnSubmit: step.kind === 'deposit',
      adapter: {
        prepare: async () => {
          if (step.id === 'initial-approval') return { type: 'skip' };
          if (step.id === 'deposit') {
            depositAttempts += 1;
            if (depositAttempts === 1)
              throw new OneKeyLocalError('deposit validation failed');
            if (depositAttempts === 2)
              return {
                type: 'change',
                change: {
                  type: 'insertApproval',
                  approvalStepId: 'second-approval',
                },
              };
          }
          return { type: 'confirm', prepared: step.id };
        },
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          sent.push(step.id);
          onBeforeSend();
          onSubmitted(`${step.id}-tx`);
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  });
  const owner = controller.attachOwner(() => true);
  await expect(controller.run(owner)).rejects.toThrow(
    'deposit validation failed',
  );
  await controller.retryTransaction(owner);
  expect(sent).toEqual(['second-approval', 'deposit']);
  expect(controller.getTask().steps.map((step) => step.id)).toEqual([
    'initial-approval',
    'second-approval',
    'deposit',
  ]);
});

it('passes a Lido permit to the transaction without publishing the signature', async () => {
  const build = jest.fn();
  const task = createEarnWorkflowTask({
    taskId: 'lido',
    identity,
    steps: [
      { id: 'permit', kind: 'sign' },
      { id: 'withdraw', kind: 'protocol', lateSubmitted: 'unknown' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'sign'
        ? {
            kind: 'sign',
            run: async () => ({
              type: 'completed',
              context: { signature: 'secret-permit' },
            }),
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            adapter: {
              prepare: async () => {
                build(context.signature);
                return { type: 'confirm', prepared: 'tx' };
              },
              confirm: async ({ onBeforeSend, onSubmitted }) => {
                onBeforeSend();
                onSubmitted('withdraw-tx');
                return { type: 'submitted' };
              },
              waitForFinalStatus: async () => 'success',
              verify: async () => true,
            },
          },
  });
  const snapshots: string[] = [];
  controller.subscribe(() =>
    snapshots.push(JSON.stringify(controller.getTask())),
  );
  await controller.run();
  expect(build).toHaveBeenCalledWith('secret-permit');
  expect(controller.getTask().steps[1].status).toEqual({
    type: 'handedOff',
    txid: 'withdraw-tx',
  });
  expect(snapshots.join()).not.toContain('secret-permit');
});

it('does not replay a Babylon push whose result is unknown', async () => {
  const push = jest.fn(async ({ context }: { context: IContext }) => {
    expect(context.psbt).toBe('signed-psbt');
    throw new OneKeyLocalError('connection lost');
  });
  const task = createEarnWorkflowTask({
    taskId: 'babylon',
    identity,
    steps: [
      { id: 'sign', kind: 'sign' },
      { id: 'push', kind: 'external' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step) =>
      step.kind === 'sign'
        ? {
            kind: 'sign',
            run: async () => ({
              type: 'completed',
              context: { psbt: 'signed-psbt' },
            }),
          }
        : {
            kind: 'external',
            prepare: async ({ context }) => context,
            execute: push,
          },
  });
  await expect(controller.run()).rejects.toThrow('connection lost');
  expect(controller.getTask().steps[1].status.type).toBe('unknown');
  expect(JSON.stringify(controller.getTask())).not.toContain('signed-psbt');
  await controller.run();
  expect(push).toHaveBeenCalledTimes(1);
});

it('does not repeat a Stakefish side effect after an unknown response', async () => {
  const execute = jest.fn(async () => ({ type: 'unknown' as const }));
  const task = createEarnWorkflowTask({
    taskId: 'stakefish',
    identity,
    steps: [{ id: 'exit', kind: 'external' }],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: () => ({
      kind: 'external',
      prepare: async ({ context }) => context,
      execute,
    }),
  });
  await controller.run();
  expect(controller.getTask().steps[0].status.type).toBe('unknown');
  await controller.run();
  expect(execute).toHaveBeenCalledTimes(1);
});

it.each(['', 'swap-tx'])(
  'gates Ethena unstake on a known hash and finality (%s)',
  async (txid) => {
    const finality = jest.fn(async () => ({ type: 'unknown' as const }));
    const unstake = jest.fn();
    const task = createEarnWorkflowTask({
      taskId: 'ethena',
      identity,
      steps: [
        { id: 'swap', kind: 'swap', lateSubmitted: 'unknown' },
        { id: 'finality', kind: 'wait' },
        { id: 'unstake', kind: 'protocol', lateSubmitted: 'unknown' },
      ],
    });
    const controller = createEarnWorkflowTaskController({
      task,
      initialContext: {} as IContext,
      isCurrent: () => true,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) => {
        if (step.kind === 'wait')
          return {
            kind: 'wait',
            run: async () => {
              expect(context.txid).toBe('swap-tx');
              return finality();
            },
          };
        return {
          kind: 'transaction',
          handoffOnSubmit: true,
          submittedContext: (previous, hash) => ({ ...previous, txid: hash }),
          adapter: {
            prepare: async () => {
              if (step.id === 'unstake') unstake();
              return { type: 'confirm', prepared: 'tx' };
            },
            confirm: async ({ onBeforeSend, onSubmitted }) => {
              onBeforeSend();
              onSubmitted(txid);
              return { type: 'submitted' };
            },
            waitForFinalStatus: async () => 'success',
            verify: async () => true,
          },
        };
      },
    });
    await controller.run();
    expect(finality).toHaveBeenCalledTimes(txid ? 1 : 0);
    expect(unstake).not.toHaveBeenCalled();
    expect(controller.getTask().steps[txid ? 1 : 0].status.type).toBe(
      'unknown',
    );
  },
);

it('runs Ethena finality before opening the second transaction', async () => {
  const order: string[] = [];
  const task = createEarnWorkflowTask({
    taskId: 'ethena-success',
    identity,
    steps: [
      { id: 'swap', kind: 'swap', lateSubmitted: 'unknown' },
      { id: 'finality', kind: 'wait' },
      { id: 'unstake', kind: 'protocol', lateSubmitted: 'unknown' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) => {
      if (step.kind === 'wait')
        return {
          kind: 'wait',
          run: async () => {
            expect(context.txid).toBe('swap-tx');
            order.push('finality');
            return { type: 'completed', context };
          },
        };
      return {
        kind: 'transaction',
        handoffOnSubmit: true,
        submittedContext: (previous, txid) => ({ ...previous, txid }),
        adapter: {
          prepare: async () => {
            order.push(`prepare-${step.id}`);
            return { type: 'confirm', prepared: 'tx' };
          },
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted(`${step.id}-tx`);
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'success',
          verify: async () => true,
        },
      };
    },
  });
  await controller.run();
  expect(order).toEqual(['prepare-swap', 'finality', 'prepare-unstake']);
});

it('does not use a late signature or restart after scope cancellation', async () => {
  let resolveSignature:
    | ((result: { type: 'completed'; context: IContext }) => void)
    | undefined;
  const signature = new Promise<{ type: 'completed'; context: IContext }>(
    (resolve) => {
      resolveSignature = resolve;
    },
  );
  const transaction = jest.fn();
  const task = createEarnWorkflowTask({
    taskId: 'scope',
    identity,
    steps: [
      { id: 'sign', kind: 'sign' },
      { id: 'next', kind: 'external' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step) =>
      step.kind === 'sign'
        ? { kind: 'sign', run: async () => signature }
        : {
            kind: 'external',
            prepare: async ({ context }) => context,
            execute: async ({ context }) => {
              transaction();
              return { type: 'completed', context };
            },
          },
  });
  const first = controller.run();
  await controller.run();
  controller.cancel();
  resolveSignature?.({
    type: 'completed',
    context: { signature: 'late-secret' },
  });
  await first;
  await controller.run();
  expect(transaction).not.toHaveBeenCalled();
  expect(controller.getTask().steps[0].status.type).toBe('cancelled');
  expect(JSON.stringify(controller.getTask())).not.toContain('late-secret');
});

it('retries only an unknown read-only finality check without replaying the transaction', async () => {
  let checks = 0;
  const send = jest.fn();
  const task = createEarnWorkflowTask({
    taskId: 'retry-finality',
    identity,
    steps: [
      { id: 'swap', kind: 'swap', lateSubmitted: 'unknown' },
      { id: 'finality', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              checks += 1;
              return checks === 1
                ? { type: 'unknown' }
                : { type: 'completed', context };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            adapter: {
              prepare: async () => ({ type: 'confirm', prepared: 'tx' }),
              confirm: async ({ onBeforeSend, onSubmitted }) => {
                send();
                onBeforeSend();
                onSubmitted('txid');
                return { type: 'submitted' };
              },
              waitForFinalStatus: async () => 'success',
              verify: async () => true,
            },
          },
  });
  await controller.retryWait();
  expect(send).not.toHaveBeenCalled();
  await controller.run();
  expect(controller.getTask().steps[1].status.type).toBe('unknown');
  await controller.retryWait();
  expect(controller.getTask().steps[1].status.type).toBe('completed');
  expect(send).toHaveBeenCalledTimes(1);
});

it('propagates transaction preparation errors and keeps the failure state', async () => {
  const task = createEarnWorkflowTask({
    taskId: 'failure',
    identity,
    steps: [{ id: 'withdraw', kind: 'protocol', lateSubmitted: 'unknown' }],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => {
          throw new OneKeyLocalError('cannot build');
        },
        confirm: async () => ({ type: 'cancelled' }),
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  });
  await expect(controller.run()).rejects.toThrow('cannot build');
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'failed',
    stage: 'beforeSend',
  });
});

it('resumes a detached transaction only after its async success callback finishes', async () => {
  let success: ((data: { txid: string }) => void | Promise<void>) | undefined;
  let finish: (() => void) | undefined;
  const callback = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const next = jest.fn();
  const confirmation = createEarnConfirmationTaskAdapter<
    typeof identity,
    ITransactionWorkflowStep,
    string,
    { txid: string },
    Error
  >({
    prepare: async () => 'prepared',
    navigate: async (_prepared, callbacks) => {
      success = callbacks.onSuccess;
    },
    onSuccess: async () => callback,
    onObserverError: (error) => {
      throw error;
    },
    getTxid: (data) => data.txid,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
  });
  const task = createEarnWorkflowTask({
    taskId: 'detached',
    identity,
    steps: [
      { id: 'first', kind: 'swap', lateSubmitted: 'unknown' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              next();
              return { type: 'completed', context };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            adapter: confirmation.adapter,
          },
  });
  await controller.run();
  const finished = success?.({ txid: 'txid' });
  expect(success?.({ txid: 'txid' })).toBeUndefined();
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'confirming',
    txid: 'txid',
  });
  await controller.run();
  expect(next).not.toHaveBeenCalled();
  finish?.();
  await finished;
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(next).toHaveBeenCalledTimes(1);
  await controller.run();
  expect(next).toHaveBeenCalledTimes(1);
});

it.each(['failure', 'scope'])(
  'does not continue after detached callback %s',
  async (outcome) => {
    let success: ((data: { txid: string }) => void | Promise<void>) | undefined;
    let finish: (() => void) | undefined;
    let reject: ((error: Error) => void) | undefined;
    const callback = new Promise<void>((resolve, fail) => {
      finish = resolve;
      reject = fail;
    });
    let current = true;
    const next = jest.fn();
    const confirmation = createEarnConfirmationTaskAdapter<
      typeof identity,
      ITransactionWorkflowStep,
      string,
      { txid: string },
      Error
    >({
      prepare: async () => 'prepared',
      navigate: async (_prepared, callbacks) => {
        success = callbacks.onSuccess;
      },
      onSuccess: async () => callback,
      onObserverError: (error) => {
        throw error;
      },
      getTxid: (data) => data.txid,
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
    const task = createEarnWorkflowTask({
      taskId: outcome,
      identity,
      steps: [
        { id: 'first', kind: 'swap', lateSubmitted: 'unknown' },
        { id: 'next', kind: 'wait' },
      ],
    });
    const controller = createEarnWorkflowTaskController({
      task,
      initialContext: {} as IContext,
      isCurrent: () => current,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) =>
        step.kind === 'wait'
          ? {
              kind: 'wait',
              run: async () => {
                next();
                return { type: 'completed', context };
              },
            }
          : {
              kind: 'transaction',
              handoffOnSubmit: true,
              adapter: confirmation.adapter,
            },
    });
    await controller.run();
    const settled = success?.({ txid: 'txid' });
    if (outcome === 'failure') {
      reject?.(new OneKeyLocalError('recording failed'));
      await expect(settled).rejects.toThrow('recording failed');
      expect(controller.getTask().steps[0]).toMatchObject({
        confirmationCallback: 'failed',
        status: { type: 'unknown', txid: 'txid' },
      });
    } else {
      current = false;
      finish?.();
      await settled;
      current = true;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    await controller.run();
    expect(next).not.toHaveBeenCalled();
  },
);

it('continues once when success is synchronous before navigation returns', async () => {
  const next = jest.fn();
  const confirmation = createEarnConfirmationTaskAdapter<
    typeof identity,
    ITransactionWorkflowStep,
    string,
    { txid: string },
    Error
  >({
    prepare: async () => 'prepared',
    navigate: async (_prepared, callbacks) => {
      void callbacks.onSuccess({ txid: 'txid' });
    },
    onSuccess: () => undefined,
    onObserverError: (error) => {
      throw error;
    },
    getTxid: (data) => data.txid,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
  });
  const task = createEarnWorkflowTask({
    taskId: 'sync',
    identity,
    steps: [
      { id: 'first', kind: 'swap', lateSubmitted: 'unknown' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              next();
              return { type: 'completed', context };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            adapter: confirmation.adapter,
          },
  });
  await Promise.all([controller.run(), controller.run()]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(next).toHaveBeenCalledTimes(1);
});

it('waits for navigation to return when async success settles first', async () => {
  let finishNavigation: (() => void) | undefined;
  let finishSuccess: (() => void) | undefined;
  let delivered: void | Promise<void> = undefined;
  const navigation = new Promise<void>((resolve) => {
    finishNavigation = resolve;
  });
  const success = new Promise<void>((resolve) => {
    finishSuccess = resolve;
  });
  const next = jest.fn();
  const confirmation = createEarnConfirmationTaskAdapter<
    typeof identity,
    ITransactionWorkflowStep,
    string,
    { txid: string },
    Error
  >({
    prepare: async () => 'prepared',
    navigate: async (_prepared, callbacks) => {
      delivered = callbacks.onSuccess({ txid: 'txid' });
      await navigation;
    },
    onSuccess: async () => success,
    onObserverError: (error) => {
      throw error;
    },
    getTxid: (data) => data.txid,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
  });
  const task = createEarnWorkflowTask({
    taskId: 'navigation',
    identity,
    steps: [
      { id: 'first', kind: 'swap', lateSubmitted: 'unknown' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              next();
              return { type: 'completed', context };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            adapter: confirmation.adapter,
          },
  });
  const running = controller.run();
  await new Promise<void>((resolve) => setImmediate(resolve));
  finishSuccess?.();
  await Promise.resolve(delivered);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(next).not.toHaveBeenCalled();
  finishNavigation?.();
  await running;
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(next).toHaveBeenCalledTimes(1);
});

it('reconciles a detached non-handoff transaction before its next step', async () => {
  let success: ((data: { txid: string }) => void | Promise<void>) | undefined;
  const order: string[] = [];
  const confirmation = createEarnConfirmationTaskAdapter<
    typeof identity,
    ITransactionWorkflowStep,
    string,
    { txid: string },
    Error
  >({
    prepare: async () => 'prepared',
    navigate: async (_prepared, callbacks) => {
      success = callbacks.onSuccess;
    },
    onSuccess: () => undefined,
    onObserverError: (error) => {
      throw error;
    },
    getTxid: (data) => data.txid,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
  });
  const task = createEarnWorkflowTask({
    taskId: 'detached-finality',
    identity,
    steps: [
      { id: 'first', kind: 'swap', lateSubmitted: 'unknown' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              order.push('next');
              return { type: 'completed', context };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: false,
            adapter: {
              ...confirmation.adapter,
              waitForFinalStatus: async ({ txid }) => {
                expect(txid).toBe('txid');
                order.push('finality');
                return 'success';
              },
              verify: async () => {
                order.push('verify');
                return true;
              },
            },
          },
  });
  await controller.run();
  await success?.({ txid: 'txid' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(order).toEqual(['finality', 'verify', 'next']);
});

it('records a late submitted hash even when task subscribers throw', async () => {
  let success: ((data: { txid: string }) => void | Promise<void>) | undefined;
  const successCallback = jest.fn(async () => undefined);
  const observerError = new OneKeyLocalError('subscriber failed');
  const reportError = jest.fn();
  const onNext = jest.fn();
  const confirmation = createEarnConfirmationTaskAdapter<
    typeof identity,
    ITransactionWorkflowStep,
    string,
    { txid: string },
    Error
  >({
    prepare: async () => 'prepared',
    navigate: async (_prepared, callbacks) => {
      success = callbacks.onSuccess;
    },
    onSuccess: successCallback,
    onObserverError: reportError,
    getTxid: (data) => data.txid,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
  });
  const task = createEarnWorkflowTask({
    taskId: 'throwing-observer',
    identity,
    steps: [
      { id: 'first', kind: 'swap', lateSubmitted: 'unknown' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: reportError,
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              onNext();
              return { type: 'completed', context };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: true,
            submittedContext: (previous, txid) => ({ ...previous, txid }),
            adapter: confirmation.adapter,
          },
  });
  await controller.run();
  const healthyObserver = jest.fn();
  const unsubscribe = controller.subscribe(() => {
    throw observerError;
  });
  controller.subscribe(healthyObserver);
  await success?.({ txid: 'late-hash' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(successCallback).toHaveBeenCalledTimes(1);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'handedOff',
    txid: 'late-hash',
  });
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(reportError).toHaveBeenCalledWith(observerError);
  expect(healthyObserver).toHaveBeenCalled();
  unsubscribe();
  await controller.run();
  expect(onNext).toHaveBeenCalledTimes(1);
});

it('publishes the completed nontransaction step with its matching execution context despite listener failures', async () => {
  const observerError = new OneKeyLocalError('subscriber failed');
  const reportError = jest.fn();
  const readContext = jest.fn();
  const task = createEarnWorkflowTask({
    taskId: 'sign-observer',
    identity,
    steps: [
      { id: 'sign', kind: 'sign' },
      { id: 'next', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: reportError,
    getAdapter: (step, context) =>
      step.kind === 'sign'
        ? {
            kind: 'sign',
            run: async () => ({
              type: 'completed',
              context: { signature: 'signed' },
            }),
          }
        : {
            kind: 'wait',
            run: async () => {
              readContext(context.signature);
              return { type: 'completed', context };
            },
          },
  });
  const unsubscribe = controller.subscribe(() => {
    throw observerError;
  });
  const healthyObserver = jest.fn();
  controller.subscribe(healthyObserver);
  await controller.run();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(readContext).toHaveBeenCalledWith('signed');
  expect(controller.getTask().steps.map(({ status }) => status.type)).toEqual([
    'completed',
    'completed',
  ]);
  expect(JSON.stringify(controller.getTask())).not.toContain('signed');
  expect(reportError).toHaveBeenCalledWith(observerError);
  expect(healthyObserver).toHaveBeenCalled();
  unsubscribe();
  await controller.run();
  expect(readContext).toHaveBeenCalledTimes(1);
});

it('continues and reports when the observer error reporter itself throws', async () => {
  const observerError = new OneKeyLocalError('observer failed');
  const reportError = jest.fn(() => {
    throw new OneKeyLocalError('reporter failed');
  });
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const task = createEarnWorkflowTask({
      taskId: 'throwing-reporter',
      identity,
      steps: [{ id: 'wait', kind: 'wait' }],
    });
    const controller = createEarnWorkflowTaskController({
      task,
      initialContext: {} as IContext,
      isCurrent: () => true,
      expiredMessage: 'expired',
      onAsyncError: reportError,
      getAdapter: (_step, context) => ({
        kind: 'wait',
        run: async () => ({ type: 'completed', context }),
      }),
    });
    controller.subscribe(() => {
      throw observerError;
    });
    await controller.run();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(controller.getTask().steps[0].status.type).toBe('completed');
    expect(reportError).toHaveBeenCalledWith(observerError);
    expect(log).toHaveBeenCalledWith(
      'Unable to report Earn task observer error',
    );
  } finally {
    log.mockRestore();
  }
});

it.each(['cancel', 'scope'])(
  'retains a late external acceptance after %s without starting the next step',
  async (invalidation) => {
    let resolveExecution:
      | ((result: { type: 'completed'; context: IContext }) => void)
      | undefined;
    let started: (() => void) | undefined;
    const invoked = new Promise<void>((resolve) => {
      started = resolve;
    });
    const execution = new Promise<{ type: 'completed'; context: IContext }>(
      (resolve) => {
        resolveExecution = resolve;
      },
    );
    let current = true;
    const execute = jest.fn(async () => {
      started?.();
      return execution;
    });
    const next = jest.fn();
    const task = createEarnWorkflowTask({
      taskId: 'late-external',
      identity,
      steps: [
        { id: 'push', kind: 'external' },
        { id: 'next', kind: 'wait' },
      ],
    });
    const controller = createEarnWorkflowTaskController({
      task,
      initialContext: {} as IContext,
      isCurrent: () => current,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) =>
        step.kind === 'external'
          ? { kind: 'external', prepare: async () => context, execute }
          : {
              kind: 'wait',
              run: async () => {
                next();
                return { type: 'completed', context };
              },
            },
    });
    const running = controller.run();
    await invoked;
    if (invalidation === 'cancel') controller.cancel();
    else current = false;
    resolveExecution?.({
      type: 'completed',
      context: { psbt: 'private-output' },
    });
    await running;
    expect(controller.getTask().steps.map(({ status }) => status.type)).toEqual(
      ['completed', 'waiting'],
    );
    expect(controller.getTask().currentStepIndex).toBe(0);
    expect(JSON.stringify(controller.getTask())).not.toContain(
      'private-output',
    );
    current = true;
    await controller.run();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  },
);

it.each([
  ['cancel', 'unknown'],
  ['cancel', 'reject'],
  ['scope', 'unknown'],
  ['scope', 'reject'],
])(
  'keeps an external side effect unknown after %s and a late %s result',
  async (invalidation, outcome) => {
    let settle: ((result: { type: 'unknown' }) => void) | undefined;
    let fail: ((error: Error) => void) | undefined;
    let started: (() => void) | undefined;
    const invoked = new Promise<void>((resolve) => {
      started = resolve;
    });
    const execution = new Promise<{ type: 'unknown' }>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    const execute = jest.fn(async () => {
      started?.();
      return execution;
    });
    let current = true;
    const next = jest.fn();
    const task = createEarnWorkflowTask({
      taskId: 'uncertain-external',
      identity,
      steps: [
        { id: 'push', kind: 'external' },
        { id: 'next', kind: 'wait' },
      ],
    });
    const controller = createEarnWorkflowTaskController({
      task,
      initialContext: {} as IContext,
      isCurrent: () => current,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) =>
        step.kind === 'external'
          ? { kind: 'external', prepare: async () => context, execute }
          : {
              kind: 'wait',
              run: async () => {
                next();
                return { type: 'completed', context };
              },
            },
    });
    const running = controller.run();
    await invoked;
    if (invalidation === 'cancel') controller.cancel();
    else current = false;
    if (outcome === 'reject') {
      fail?.(new OneKeyLocalError('push result unavailable'));
      await expect(running).rejects.toThrow('push result unavailable');
    } else {
      settle?.({ type: 'unknown' });
      await running;
    }
    expect(controller.getTask().steps.map(({ status }) => status.type)).toEqual(
      ['unknown', 'waiting'],
    );
    current = true;
    await controller.run();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  },
);

it.each([
  { optIn: true, allowance: true, expectedChecks: 1, expectedWithdrawals: 1 },
  { optIn: true, allowance: false, expectedChecks: 1, expectedWithdrawals: 0 },
  { optIn: false, allowance: true, expectedChecks: 0, expectedWithdrawals: 0 },
])(
  'only follows an unknown approval with an opted-in allowance check: $optIn $allowance',
  async ({ optIn, allowance, expectedChecks, expectedWithdrawals }) => {
    let success: ((data: { txid: string }) => void | Promise<void>) | undefined;
    const checkAllowance = jest.fn(async () => allowance);
    const prepareWithdrawal = jest.fn();
    const confirmation = createEarnConfirmationTaskAdapter<
      typeof identity,
      ITransactionWorkflowStep,
      string,
      { txid: string },
      Error
    >({
      prepare: async () => 'approval',
      navigate: async (_prepared, callbacks) => {
        success = callbacks.onSuccess;
      },
      onObserverError: jest.fn(),
      getTxid: (data) => data.txid,
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
    const task = createEarnWorkflowTask({
      taskId: 'missing-approval-txid',
      identity,
      steps: [
        { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
        { id: 'allowance', kind: 'wait' },
        { id: 'withdraw', kind: 'protocol', lateSubmitted: 'unknown' },
      ],
    });
    const controller = createEarnWorkflowTaskController<
      typeof identity,
      IContext,
      string
    >({
      task,
      initialContext: {} as IContext,
      isCurrent: () => true,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) => {
        if (step.kind === 'wait')
          return {
            kind: 'wait',
            run: async () =>
              (await checkAllowance())
                ? { type: 'completed', context }
                : { type: 'unknown' },
          };
        if (step.kind === 'approve')
          return {
            kind: 'transaction',
            handoffOnSubmit: true,
            ...(optIn ? { allowanceCheckAfterMissingTxid: 'allowance' } : {}),
            adapter: confirmation.adapter,
          };
        return {
          kind: 'transaction',
          handoffOnSubmit: true,
          adapter: {
            prepare: async () => {
              prepareWithdrawal();
              return { type: 'confirm', prepared: 'withdraw' };
            },
            confirm: async ({ onBeforeSend, onSubmitted }) => {
              onBeforeSend();
              onSubmitted('withdraw-tx');
              return { type: 'submitted' };
            },
            waitForFinalStatus: async () => 'success',
            verify: async () => true,
          },
        };
      },
    });
    await controller.run();
    await success?.({ txid: '' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
    expect(checkAllowance).toHaveBeenCalledTimes(expectedChecks);
    expect(prepareWithdrawal).toHaveBeenCalledTimes(expectedWithdrawals);
    await success?.({ txid: '' });
    await controller.run();
    expect(checkAllowance).toHaveBeenCalledTimes(expectedChecks);
    expect(prepareWithdrawal).toHaveBeenCalledTimes(expectedWithdrawals);
  },
);

it.each(['cancel', 'scope'])(
  'does not start allowance checking after %s during an empty-txid approval callback',
  async (invalidation) => {
    let success: ((data: { txid: string }) => void | Promise<void>) | undefined;
    let finish: (() => void) | undefined;
    const callback = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let current = true;
    const checkAllowance = jest.fn();
    const confirmation = createEarnConfirmationTaskAdapter<
      typeof identity,
      ITransactionWorkflowStep,
      string,
      { txid: string },
      Error
    >({
      prepare: async () => 'approval',
      navigate: async (_prepared, callbacks) => {
        success = callbacks.onSuccess;
      },
      onSuccess: async () => callback,
      onObserverError: jest.fn(),
      getTxid: (data) => data.txid,
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
    const task = createEarnWorkflowTask({
      taskId: 'invalidated-approval',
      identity,
      steps: [
        { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
        { id: 'allowance', kind: 'wait' },
      ],
    });
    const controller = createEarnWorkflowTaskController<
      typeof identity,
      IContext,
      string
    >({
      task,
      initialContext: {} as IContext,
      isCurrent: () => current,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) =>
        step.kind === 'wait'
          ? {
              kind: 'wait',
              run: async () => {
                checkAllowance();
                return { type: 'completed', context };
              },
            }
          : {
              kind: 'transaction',
              handoffOnSubmit: false,
              allowanceCheckAfterMissingTxid: 'allowance',
              adapter: confirmation.adapter,
            },
    });
    await controller.run();
    const settled = success?.({ txid: '' });
    if (invalidation === 'cancel') controller.cancel();
    else current = false;
    finish?.();
    await settled;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(checkAllowance).not.toHaveBeenCalled();
    expect(controller.getTask().steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
  },
);

it('records a late approval txid after cancellation without checking allowance', async () => {
  let cancel: (() => void) | undefined;
  let send: (() => void) | undefined;
  let late: ((txid: string) => boolean) | undefined;
  const checkAllowance = jest.fn();
  const confirmation = createEarnConfirmationTaskAdapter<
    typeof identity,
    ITransactionWorkflowStep,
    string,
    { txid: string },
    Error
  >({
    prepare: async () => 'approval',
    navigate: async (_prepared, callbacks) => {
      send = callbacks.onSendObserved;
      cancel = callbacks.onCancel;
      late = callbacks.onLateBroadcastAccepted;
    },
    onObserverError: jest.fn(),
    getTxid: (data) => data.txid,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
  });
  const task = createEarnWorkflowTask({
    taskId: 'late-approval',
    identity,
    steps: [
      { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
      { id: 'allowance', kind: 'wait' },
    ],
  });
  const controller = createEarnWorkflowTaskController<
    typeof identity,
    IContext,
    string
  >({
    task,
    initialContext: {} as IContext,
    isCurrent: () => true,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'wait'
        ? {
            kind: 'wait',
            run: async () => {
              checkAllowance();
              return { type: 'completed', context };
            },
          }
        : {
            kind: 'transaction',
            handoffOnSubmit: false,
            allowanceCheckAfterMissingTxid: 'allowance',
            adapter: confirmation.adapter,
          },
  });
  await controller.run();
  send?.();
  cancel?.();
  expect(late?.('late-approval-tx')).toBe(true);
  expect(controller.getTask().steps[0].status).toEqual({
    type: 'unknown',
    txid: 'late-approval-tx',
    chainConfirmed: false,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(checkAllowance).not.toHaveBeenCalled();
  expect(controller.getTask().currentStepIndex).toBe(0);
});

it.each(['cancel', 'scope'])(
  'does not prepare withdrawal after %s during the allowance check',
  async (invalidation) => {
    let success: ((data: { txid: string }) => void | Promise<void>) | undefined;
    let finishAllowance: ((allowed: boolean) => void) | undefined;
    const allowance = new Promise<boolean>((resolve) => {
      finishAllowance = resolve;
    });
    let current = true;
    const checkAllowance = jest.fn(() => allowance);
    const prepareWithdrawal = jest.fn();
    const confirmation = createEarnConfirmationTaskAdapter<
      typeof identity,
      ITransactionWorkflowStep,
      string,
      { txid: string },
      Error
    >({
      prepare: async () => 'approval',
      navigate: async (_prepared, callbacks) => {
        success = callbacks.onSuccess;
      },
      onObserverError: jest.fn(),
      getTxid: (data) => data.txid,
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
    const task = createEarnWorkflowTask({
      taskId: 'invalidate-allowance',
      identity,
      steps: [
        { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
        { id: 'allowance', kind: 'wait' },
        { id: 'withdraw', kind: 'protocol', lateSubmitted: 'unknown' },
      ],
    });
    const controller = createEarnWorkflowTaskController<
      typeof identity,
      IContext,
      string
    >({
      task,
      initialContext: {} as IContext,
      isCurrent: () => current,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) => {
        if (step.kind === 'wait')
          return {
            kind: 'wait',
            run: async () =>
              (await checkAllowance())
                ? { type: 'completed', context }
                : { type: 'unknown' },
          };
        if (step.kind === 'approve')
          return {
            kind: 'transaction',
            handoffOnSubmit: false,
            allowanceCheckAfterMissingTxid: 'allowance',
            adapter: confirmation.adapter,
          };
        return {
          kind: 'transaction',
          handoffOnSubmit: true,
          adapter: {
            prepare: async () => {
              prepareWithdrawal();
              return { type: 'confirm', prepared: 'withdraw' };
            },
            confirm: async () => ({ type: 'submitted' }),
            waitForFinalStatus: async () => 'success',
            verify: async () => true,
          },
        };
      },
    });
    await controller.run();
    await success?.({ txid: '' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(checkAllowance).toHaveBeenCalledTimes(1);
    if (invalidation === 'cancel') controller.cancel();
    else current = false;
    finishAllowance?.(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(prepareWithdrawal).not.toHaveBeenCalled();
    expect(controller.getTask().steps[0].status.type).toBe('unknown');
  },
);
