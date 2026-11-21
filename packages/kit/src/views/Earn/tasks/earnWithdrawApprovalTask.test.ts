import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnConfirmationTaskAdapter } from './confirmationTaskAdapter';
import { createEarnWithdrawApprovalTask } from './earnWithdrawApprovalTask';

import type {
  IEarnWithdrawApprovalIdentity,
  IEarnWithdrawProtocolFragment,
  IEarnWithdrawWorkflowAdapter,
  IEarnWithdrawWorkflowHandoff,
} from './earnWithdrawApprovalTask';
import type {
  IEarnWorkflowStepPlan,
  IEarnWorkflowTaskStep,
} from './earnWorkflowTaskState';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

const identity: IEarnWithdrawApprovalIdentity = {
  accountId: 'account',
  networkId: 'evm--1',
  accountAddress: '0x123',
  provider: 'pendle',
  action: 'withdraw',
};
type IContext = { swapTxid?: string; signature?: string };
const initialContext: IContext = {};
const protocolSteps: IEarnWorkflowStepPlan[] = [
  { id: 'withdraw', kind: 'protocol', lateSubmitted: 'confirming' },
];

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function fixture({
  prepareBusiness,
  allowanceCheck = async () => true,
  skipApproval = false,
  signal,
  approvalOverride,
  allowMissingTxidAllowanceCheck = false,
  isCurrent = () => true,
  isCurrentAfterHandoff,
  protocolStepsOverride,
  identityOverride,
}: {
  prepareBusiness?: (
    handoff: IEarnWithdrawWorkflowHandoff<string, IContext>,
  ) => Promise<void>;
  allowanceCheck?: (signal: AbortSignal) => Promise<boolean>;
  skipApproval?: boolean;
  signal?: AbortSignal;
  approvalOverride?: Extract<
    IEarnWithdrawWorkflowAdapter<string, IContext>,
    { kind: 'transaction' }
  >;
  allowMissingTxidAllowanceCheck?: boolean;
  isCurrent?: () => boolean;
  isCurrentAfterHandoff?: () => boolean;
  protocolStepsOverride?: readonly IEarnWorkflowStepPlan[];
  identityOverride?: IEarnWithdrawApprovalIdentity;
} = {}) {
  const calls: string[] = [];
  const protocolResult = deferred<boolean>();
  const onAsyncError = jest.fn();
  const approval: Extract<
    IEarnWithdrawWorkflowAdapter<string, IContext>,
    { kind: 'transaction' }
  > = {
    kind: 'transaction',
    handoffOnSubmit: true,
    adapter: {
      prepare: async () => {
        calls.push('prepare approval');
        return skipApproval
          ? { type: 'skip' }
          : { type: 'confirm', prepared: 'approve' };
      },
      confirm: async ({ prepared, onBeforeSend, onSubmitted }) => {
        expect(prepared).toBe('approve');
        calls.push('approve');
        onBeforeSend();
        onSubmitted('approval-tx');
        return { type: 'submitted' };
      },
      waitForFinalStatus: async () => 'success',
      verify: async () => true,
    },
  };
  const protocol: IEarnWithdrawProtocolFragment<string, IContext> = {
    identity,
    steps: protocolSteps,
    result: protocolResult.promise,
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => {
          calls.push('prepare withdrawal');
          return { type: 'confirm', prepared: 'withdraw' };
        },
        confirm: async ({ prepared, onBeforeSend, onSubmitted }) => {
          expect(prepared).toBe('withdraw');
          calls.push('withdraw');
          onBeforeSend();
          onSubmitted('withdraw-tx');
          protocolResult.resolve(true);
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  };
  const task = createEarnWithdrawApprovalTask({
    taskId: 'withdraw-task',
    identity: identityOverride ?? identity,
    protocolSteps: protocolStepsOverride ?? protocolSteps,
    initialContext,
    approval: {
      ...(approvalOverride ?? approval),
      allowMissingTxidAllowanceCheck,
    },
    signal,
    allowanceCheck: async (taskSignal) => {
      calls.push('allowance');
      return allowanceCheck(taskSignal);
    },
    prepareBusiness:
      prepareBusiness ??
      (async (handoff) => {
        calls.push('register');
        await handoff.register(protocol);
      }),
    isCurrent,
    isCurrentAfterHandoff,
    onAsyncError,
  });
  return { task, calls, protocol, protocolResult, onAsyncError };
}

it('does not create an approval task without its account address', () => {
  expect(() =>
    fixture({ identityOverride: { ...identity, accountAddress: '' } }),
  ).toThrow('Earn withdrawal account address is missing');
});

it('executes approval, allowance and registered withdrawal in one task', async () => {
  const { task, calls } = fixture();
  await expect(task.run()).resolves.toBe(true);
  expect(calls).toEqual([
    'prepare approval',
    'approve',
    'allowance',
    'register',
    'prepare withdrawal',
    'withdraw',
  ]);
  expect(task.getTask().taskId).toBe('withdraw-task');
  expect(task.getTask().steps.map(({ id }) => id)).toEqual([
    'approve',
    'allowance',
    'prepareBusiness',
    'withdraw',
  ]);
});

it('preserves protocol context across a sign step and the following transaction', async () => {
  const result = deferred<boolean>();
  const signedSteps: IEarnWorkflowStepPlan[] = [
    { id: 'sign', kind: 'sign' },
    { id: 'withdraw', kind: 'protocol', lateSubmitted: 'confirming' },
  ];
  const build = jest.fn();
  const { task } = fixture({
    protocolStepsOverride: signedSteps,
    prepareBusiness: async (handoff) => {
      await handoff.register({
        identity,
        steps: signedSteps,
        result: result.promise,
        getAdapter: (step, context) =>
          step.kind === 'sign'
            ? {
                kind: 'sign',
                run: async () => ({
                  type: 'completed',
                  context: { ...context, signature: 'signed' },
                }),
              }
            : {
                kind: 'transaction',
                handoffOnSubmit: true,
                adapter: {
                  prepare: async () => {
                    build(context.signature);
                    return { type: 'confirm', prepared: 'withdraw' };
                  },
                  confirm: async ({ onBeforeSend, onSubmitted }) => {
                    onBeforeSend();
                    onSubmitted('withdraw-tx');
                    result.resolve(true);
                    return { type: 'submitted' };
                  },
                  waitForFinalStatus: async () => 'success',
                  verify: async () => true,
                },
              },
      });
    },
  });
  await expect(task.run()).resolves.toBe(true);
  expect(build).toHaveBeenCalledWith('signed');
});

it('returns to the form without executing the protocol if allowance was already sufficient', async () => {
  const { task, calls } = fixture({ skipApproval: true });
  await expect(task.run()).resolves.toBe(false);
  expect(calls).toEqual(['prepare approval']);
});

it('does not register or execute the protocol when the allowance check fails', async () => {
  const { task, calls } = fixture({ allowanceCheck: async () => false });
  await expect(task.run()).resolves.toBe(false);
  expect(calls).toEqual(['prepare approval', 'approve', 'allowance']);
});

it('reports an allowance request error instead of treating it as insufficient allowance', async () => {
  const error = new OneKeyLocalError('allowance unavailable');
  const { task, calls } = fixture({
    allowanceCheck: async () => {
      throw error;
    },
  });
  await expect(task.run()).rejects.toThrow('allowance unavailable');
  expect(calls).not.toContain('register');
});

function detachedApproval(onSuccess?: () => Promise<void>) {
  type ITransactionStep = Exclude<
    IEarnWorkflowTaskStep,
    { kind: 'sign' | 'external' | 'wait' }
  >;
  const callbacks = deferred<{
    onSuccess: (data: string) => void | Promise<void>;
    onFail: (error: Error) => void;
    onCancel: () => void;
    onSendObserved: () => void;
    onLateBroadcastAccepted: (txid: string) => boolean;
  }>();
  const confirmation = createEarnConfirmationTaskAdapter<
    IEarnWithdrawApprovalIdentity,
    ITransactionStep,
    string,
    string,
    Error
  >({
    prepare: async () => 'approve',
    navigate: async (_prepared, handlers) => callbacks.resolve(handlers),
    onSuccess,
    getTxid: (data) => data,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
    onObserverError: jest.fn(),
  });
  const adapter: Extract<
    IEarnWithdrawWorkflowAdapter<string, IContext>,
    { kind: 'transaction' }
  > = {
    kind: 'transaction',
    handoffOnSubmit: true,
    adapter: confirmation.adapter,
  };
  return { callbacks: callbacks.promise, adapter };
}

it.each(['cancel', 'fail'] as const)(
  'settles an unknown approval after %s without querying allowance',
  async (outcome) => {
    const detached = detachedApproval();
    const { task, calls } = fixture({
      approvalOverride: detached.adapter,
      allowMissingTxidAllowanceCheck: true,
    });
    const result = task.run();
    const callbacks = await detached.callbacks;
    callbacks.onSendObserved();
    if (outcome === 'cancel') callbacks.onCancel();
    else callbacks.onFail(new OneKeyLocalError('confirmation failed'));
    await expect(result).resolves.toBe(false);
    expect(calls).not.toContain('allowance');
    expect(task.getTask().steps[0].status.type).toBe('unknown');
  },
);

it('settles when a detached approval success callback rejects', async () => {
  const callback = deferred<void>();
  const detached = detachedApproval(() => callback.promise);
  const { task, calls } = fixture({
    approvalOverride: detached.adapter,
    allowMissingTxidAllowanceCheck: true,
  });
  const result = task.run();
  const callbacks = await detached.callbacks;
  callbacks.onSendObserved();
  const settled = callbacks.onSuccess('');
  callback.reject(new OneKeyLocalError('approval callback failed'));
  await expect(settled).rejects.toThrow('approval callback failed');
  const outcome = await Promise.race([
    result,
    new Promise<'pending'>((resolve) =>
      setTimeout(() => resolve('pending'), 50),
    ),
  ]);
  expect(outcome).toBe(false);
  expect(calls).not.toContain('allowance');
});

it('checks allowance after a successful legacy approval callback with no txid', async () => {
  const detached = detachedApproval();
  const { task, calls } = fixture({
    approvalOverride: detached.adapter,
    allowMissingTxidAllowanceCheck: true,
  });
  const result = task.run();
  const callbacks = await detached.callbacks;
  callbacks.onSendObserved();
  await callbacks.onSuccess('');
  await expect(result).resolves.toBe(true);
  expect(calls).toContain('allowance');
  expect(calls).toContain('withdraw');
  expect(task.getTask().steps[0].status).toEqual({
    type: 'unknown',
    chainConfirmed: false,
  });
});

it('does not query allowance for a strict approval callback with no txid', async () => {
  const detached = detachedApproval();
  const { task, calls } = fixture({ approvalOverride: detached.adapter });
  const result = task.run();
  const callbacks = await detached.callbacks;
  callbacks.onSendObserved();
  await callbacks.onSuccess('');
  await expect(result).resolves.toBe(false);
  expect(calls).not.toContain('allowance');
  expect(task.getTask().steps[0].status.type).toBe('unknown');
});

it('cancels a registration that never arrives when its owner aborts', async () => {
  const abort = new AbortController();
  const pending = deferred<void>();
  const started = deferred<void>();
  const { task } = fixture({
    signal: abort.signal,
    prepareBusiness: async () => {
      started.resolve();
      await pending.promise;
    },
  });
  const result = task.run();
  await started.promise;
  abort.abort();
  await expect(result).resolves.toBe(false);
  pending.resolve();
});

it('settles both the task and registration when its owner aborts after registration', async () => {
  const abort = new AbortController();
  const detached = detachedApproval();
  const completion = deferred<boolean>();
  const operation = deferred<void>();
  const { task } = fixture({
    signal: abort.signal,
    prepareBusiness: async (handoff) => {
      await handoff.register({
        identity,
        steps: protocolSteps,
        getAdapter: () => detached.adapter,
        result: completion.promise,
      });
      operation.resolve();
    },
  });
  const result = task.run();
  await detached.callbacks;
  abort.abort();
  await expect(result).resolves.toBe(false);
  await expect(operation.promise).resolves.toBeUndefined();
});

it('stops cleanly when the business operation returns without registering', async () => {
  const { task } = fixture({ prepareBusiness: async () => undefined });
  await expect(task.run()).resolves.toBe(false);
});

it('rejects a different protocol plan and never opens its transaction', async () => {
  const { task, protocol, calls } = fixture({
    prepareBusiness: async (handoff) => {
      await handoff.register({
        ...protocol,
        steps: [{ id: 'other', kind: 'protocol', lateSubmitted: 'confirming' }],
      });
    },
  });
  await expect(task.run()).rejects.toThrow(
    'Invalid Earn withdrawal registration',
  );
  expect(calls).not.toContain('withdraw');
});

it('rejects another account and never opens its transaction', async () => {
  const { task, protocol, calls } = fixture({
    prepareBusiness: async (handoff) => {
      await handoff.register({
        ...protocol,
        identity: { ...identity, accountId: 'other' },
      });
    },
  });
  await expect(task.run()).rejects.toThrow(
    'Invalid Earn withdrawal registration',
  );
  expect(calls).not.toContain('withdraw');
});

it('rejects a changed account address and never opens its transaction', async () => {
  const { task, protocol, calls } = fixture({
    prepareBusiness: async (handoff) => {
      await handoff.register({
        ...protocol,
        identity: { ...identity, accountAddress: '0xother' },
      });
    },
  });
  await expect(task.run()).rejects.toThrow(
    'Invalid Earn withdrawal registration',
  );
  expect(calls).not.toContain('withdraw');
});

it('keeps the protocol confirmation current after form handoff with its own owner guard', async () => {
  let actionCurrent = true;
  let sendCurrent = true;
  const detached = detachedApproval();
  const completion = deferred<boolean>();
  const { task } = fixture({
    isCurrent: () => actionCurrent,
    isCurrentAfterHandoff: () => sendCurrent,
    prepareBusiness: async (handoff) => {
      await handoff.register({
        identity,
        steps: protocolSteps,
        getAdapter: () => detached.adapter,
        result: completion.promise,
      });
    },
  });
  const result = task.run();
  const callbacks = await detached.callbacks;
  completion.resolve(true);
  await expect(result).resolves.toBe(true);
  actionCurrent = false;
  callbacks.onSendObserved();
  await callbacks.onSuccess('withdraw-tx');
  expect(task.getTask().steps.at(-1)?.status.type).toBe('handedOff');
  sendCurrent = false;
});

it('rejects a duplicate registration without executing a second protocol', async () => {
  const duplicate = deferred<unknown>();
  const { task, protocol, calls } = fixture({
    prepareBusiness: async (handoff) => {
      const first = handoff.register(protocol);
      try {
        await handoff.register(protocol);
      } catch (error) {
        duplicate.resolve(error);
      }
      await first;
    },
  });
  await expect(task.run()).resolves.toBe(true);
  expect(await duplicate.promise).toBeInstanceOf(OneKeyLocalError);
  expect(calls.filter((call) => call === 'withdraw')).toHaveLength(1);
});

it('reports an operation failure after registration without hanging', async () => {
  const error = new OneKeyLocalError('late operation failure');
  const lateFailure = deferred<void>();
  const { task, protocol, onAsyncError } = fixture({
    prepareBusiness: async (handoff) => {
      await handoff.register(protocol);
      await lateFailure.promise;
      throw error;
    },
  });
  await expect(task.run()).resolves.toBe(true);
  lateFailure.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(onAsyncError).toHaveBeenCalledWith(error);
});

it('stops protocol preparation if the registered business operation fails', async () => {
  const protocolPrepared = deferred<{ type: 'confirm'; prepared: string }>();
  const preparationStarted = deferred<void>();
  const business = deferred<void>();
  const confirm = jest.fn(async () => ({ type: 'submitted' as const }));
  const registration =
    deferred<IEarnWithdrawWorkflowHandoff<string, IContext>>();
  const { task, protocol } = fixture({
    prepareBusiness: async (handoff) => {
      registration.resolve(handoff);
      await business.promise;
    },
  });
  const result = task.run();
  const handoff = await registration.promise;
  const fragment: IEarnWithdrawProtocolFragment<string, IContext> = {
    ...protocol,
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => {
          preparationStarted.resolve();
          return protocolPrepared.promise;
        },
        confirm,
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  };
  const registered = handoff.register(fragment);
  void registered.catch(() => undefined);
  await preparationStarted.promise;
  business.reject(new OneKeyLocalError('business failed'));
  await expect(result).rejects.toThrow('business failed');
  protocolPrepared.resolve({ type: 'confirm', prepared: 'withdraw' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(confirm).not.toHaveBeenCalled();
});

it('reports a post-handoff protocol error once', async () => {
  const failConfirm = deferred<void>();
  const error = new OneKeyLocalError('late confirmation failure');
  const handoffReady =
    deferred<IEarnWithdrawWorkflowHandoff<string, IContext>>();
  const { task, protocol, protocolResult, onAsyncError } = fixture({
    prepareBusiness: async (handoff) => {
      handoffReady.resolve(handoff);
      await protocolResult.promise;
    },
  });
  const result = task.run();
  const handoff = await handoffReady.promise;
  const fragment: IEarnWithdrawProtocolFragment<string, IContext> = {
    ...protocol,
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'withdraw' }),
        confirm: async () => {
          protocolResult.resolve(true);
          await failConfirm.promise;
          throw error;
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  };
  const registered = handoff.register(fragment);
  await expect(result).resolves.toBe(true);
  await expect(registered).resolves.toBe(true);
  failConfirm.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(onAsyncError).toHaveBeenCalledTimes(1);
  expect(onAsyncError).toHaveBeenCalledWith(error);
});

it('does not hand off a protocol result after its action scope expires', async () => {
  let current = true;
  const detached = detachedApproval();
  const completion = deferred<boolean>();
  const { task } = fixture({
    isCurrent: () => current,
    isCurrentAfterHandoff: () => true,
    prepareBusiness: async (handoff) => {
      await handoff.register({
        identity,
        steps: protocolSteps,
        getAdapter: () => detached.adapter,
        result: completion.promise,
      });
    },
  });
  const result = task.run();
  await detached.callbacks;
  current = false;
  completion.resolve(true);
  await expect(result).resolves.toBe(false);
});

it('lets a protocol observe its committed skipped step before reporting an external exit', async () => {
  const observed = deferred<boolean>();
  const handoffReady =
    deferred<IEarnWithdrawWorkflowHandoff<string, IContext>>();
  const { task, protocol } = fixture({
    prepareBusiness: async (handoff) => {
      handoffReady.resolve(handoff);
      await observed.promise;
    },
  });
  const result = task.run();
  const handoff = await handoffReady.promise;
  const fragment: IEarnWithdrawProtocolFragment<string, IContext> = {
    ...protocol,
    result: observed.promise,
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'skip' }),
        confirm: async () => ({ type: 'submitted' }),
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
    observeTask: (snapshot) => {
      const step = snapshot.steps.find((item) => item.id === 'withdraw');
      if (step?.status.type === 'skipped') observed.resolve(true);
    },
  };
  const registered = handoff.register(fragment);
  const outcome = await Promise.race([
    result,
    new Promise<'pending'>((resolve) =>
      setTimeout(() => resolve('pending'), 50),
    ),
  ]);
  expect(outcome).toBe(true);
  await expect(registered).resolves.toBe(true);
  expect(task.getTask().steps.at(-1)?.status.type).toBe('skipped');
});

it('cancels a registered fragment when its task owner cancels', async () => {
  const handoffReady =
    deferred<IEarnWithdrawWorkflowHandoff<string, IContext>>();
  const preparationStarted = deferred<void>();
  const pendingPreparation = deferred<{ type: 'confirm'; prepared: string }>();
  const { task, protocol, protocolResult } = fixture({
    prepareBusiness: async (handoff) => {
      handoffReady.resolve(handoff);
      await protocol.result;
    },
  });
  const cancelFragment = jest.fn(() => protocolResult.resolve(false));
  const result = task.run();
  const handoff = await handoffReady.promise;
  const registered = handoff.register({
    ...protocol,
    cancel: cancelFragment,
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => {
          preparationStarted.resolve();
          return pendingPreparation.promise;
        },
        confirm: async () => ({ type: 'submitted' }),
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  });
  await preparationStarted.promise;
  task.cancel();
  await expect(result).resolves.toBe(false);
  await expect(registered).resolves.toBe(false);
  expect(cancelFragment).toHaveBeenCalledTimes(1);
  pendingPreparation.resolve({ type: 'confirm', prepared: 'withdraw' });
});

it('stops the task and reports an observer exception', async () => {
  const handoffReady =
    deferred<IEarnWithdrawWorkflowHandoff<string, IContext>>();
  const error = new OneKeyLocalError('protocol observer failed');
  const { task, protocol } = fixture({
    prepareBusiness: async (handoff) => {
      handoffReady.resolve(handoff);
      await protocol.result;
    },
  });
  const result = task.run();
  const handoff = await handoffReady.promise;
  const registered = handoff.register({
    ...protocol,
    observeTask: () => {
      throw error;
    },
  });
  void registered.catch(() => undefined);
  await expect(result).rejects.toThrow('protocol observer failed');
});

it('lets the protocol classify a stale preparation error after cancellation', async () => {
  const handoffReady =
    deferred<IEarnWithdrawWorkflowHandoff<string, IContext>>();
  const preparationStarted = deferred<void>();
  const preparation = deferred<{ type: 'confirm'; prepared: string }>();
  const staleError = new OneKeyLocalError('expired action');
  const classify = jest.fn();
  let current = true;
  const { task, protocol, onAsyncError } = fixture({
    isCurrent: () => current,
    prepareBusiness: async (handoff) => {
      handoffReady.resolve(handoff);
      await protocol.result;
    },
  });
  const result = task.run();
  const handoff = await handoffReady.promise;
  const registered = handoff.register({
    ...protocol,
    onStaleTransactionError: classify,
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => {
          preparationStarted.resolve();
          return preparation.promise;
        },
        confirm: async () => ({ type: 'submitted' }),
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  });
  await preparationStarted.promise;
  current = false;
  task.cancel();
  await expect(result).resolves.toBe(false);
  await expect(registered).resolves.toBe(false);
  preparation.reject(staleError);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(classify).toHaveBeenCalledWith(staleError);
  expect(onAsyncError).not.toHaveBeenCalled();
});

it('settles if a fragment throws while being cancelled', async () => {
  const handoffReady =
    deferred<IEarnWithdrawWorkflowHandoff<string, IContext>>();
  const preparationStarted = deferred<void>();
  const pendingPreparation = deferred<{ type: 'confirm'; prepared: string }>();
  const error = new OneKeyLocalError('fragment cancellation failed');
  const { task, protocol } = fixture({
    prepareBusiness: async (handoff) => {
      handoffReady.resolve(handoff);
      await protocol.result;
    },
  });
  const result = task.run();
  const handoff = await handoffReady.promise;
  const registered = handoff.register({
    ...protocol,
    cancel: () => {
      throw error;
    },
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => {
          preparationStarted.resolve();
          return pendingPreparation.promise;
        },
        confirm: async () => ({ type: 'submitted' }),
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  });
  void registered.catch(() => undefined);
  await preparationStarted.promise;
  task.cancel();
  const outcome = await Promise.race([
    result.then(
      () => 'resolved',
      () => 'rejected',
    ),
    new Promise<'pending'>((resolve) =>
      setTimeout(() => resolve('pending'), 50),
    ),
  ]);
  expect(outcome).toBe('rejected');
  pendingPreparation.resolve({ type: 'confirm', prepared: 'withdraw' });
});
