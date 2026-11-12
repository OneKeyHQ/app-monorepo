import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnWithdrawApprovalTask } from './earnWithdrawApprovalTask';

import type {
  IEarnWithdrawApprovalIdentity,
  IEarnWithdrawProtocolFragment,
  IEarnWithdrawWorkflowAdapter,
  IEarnWithdrawWorkflowHandoff,
} from './earnWithdrawApprovalTask';
import type { IEarnWorkflowStepPlan } from './earnWorkflowTaskState';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

const identity: IEarnWithdrawApprovalIdentity = {
  accountId: 'btc-account',
  accountAddress: 'btc-address-A',
  networkId: 'btc--0',
  provider: 'babylon',
  action: 'withdraw',
};

type IContext = { signedPsbt?: string };
type IFacts = { build: 'pending' | 'prepared' | 'broadcast' };
type IFact = { type: 'buildAccepted'; broadcast: boolean };
type IFactParams = { stepId: string; attemptId: string; fact: IFact };
type IFactRecorder = (params: IFactParams) => boolean;
type IFragment = IEarnWithdrawProtocolFragment<string, IContext, IFact>;
type IAdapter = IEarnWithdrawWorkflowAdapter<string, IContext>;
type ISignAdapter = Extract<IAdapter, { kind: 'sign' }>;
type ISignContext = Parameters<ISignAdapter['run']>[0];
type ISignContinuation = ReturnType<ISignContext['createContinuation']>;

type ISignResult = { type: 'continued' } | { type: 'cancelled' };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function waitForProgress<T>(progress: Promise<T>, result: Promise<boolean>) {
  return Promise.race([
    progress,
    result.then(() => {
      throw new OneKeyLocalError('Workflow ended before the expected step');
    }),
  ]);
}

const approval: Extract<IAdapter, { kind: 'transaction' }> = {
  kind: 'transaction',
  handoffOnSubmit: true,
  adapter: {
    prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
    confirm: async ({ onBeforeSend, onSubmitted }) => {
      onBeforeSend();
      onSubmitted('approval-tx');
      return { type: 'submitted' };
    },
    waitForFinalStatus: async () => 'success',
    verify: async () => true,
  },
};

const protocolSteps: readonly IEarnWorkflowStepPlan[] = [
  { id: 'build', kind: 'external' },
  { id: 'sign', kind: 'sign' },
  { id: 'push', kind: 'external' },
];

function retainedFixture({
  pendingBuild = false,
  handedOff = true,
  requireFacts = false,
}: {
  pendingBuild?: boolean;
  handedOff?: boolean;
  requireFacts?: boolean;
} = {}) {
  const signal = new AbortController();
  const result = deferred<boolean>();
  const ready = deferred<void>();
  const buildStarted = deferred<{ stepId: string; attemptId: string }>();
  const buildResult = deferred<{ broadcast: boolean }>();
  const signed = deferred<ISignResult>();
  const publicCallbacks = jest.fn();
  const push = jest.fn(async () => undefined);
  const detached = jest.fn();
  const onAsyncError = jest.fn();
  let viewDetached = false;
  let continuation: ISignContinuation | undefined;
  let recordFact: IFactRecorder | undefined;
  let current = true;
  const fragment = {
    identity,
    steps: protocolSteps,
    result: result.promise,
    bindRuntime: ({ recordFact: record }: { recordFact: IFactRecorder }) => {
      recordFact = record;
    },
    detachView: () => {
      viewDetached = true;
      detached();
    },
    getAdapter: ((step, context) => {
      if (step.id === 'build')
        return {
          kind: 'external',
          prepare: async () => context,
          execute: async ({ stepId, attemptId }) => {
            buildStarted.resolve({ stepId, attemptId });
            const response = pendingBuild
              ? await buildResult.promise
              : { broadcast: false };
            if (!recordFact && requireFacts)
              throw new OneKeyLocalError('Babylon facts not bound');
            if (recordFact) {
              const recorded = recordFact({
                stepId,
                attemptId,
                fact: { type: 'buildAccepted', broadcast: response.broadcast },
              });
              if (!recorded)
                throw new OneKeyLocalError('Babylon fact rejected');
            }
            return { type: 'completed', context };
          },
        };
      if (step.id === 'sign')
        return {
          kind: 'sign',
          run: async ({ createContinuation }) => {
            continuation = createContinuation({
              externalStepId: 'push',
              requestId: 'request-1',
            });
            ready.resolve();
            if (!handedOff) current = false;
            result.resolve(handedOff);
            return signed.promise;
          },
        };
      if (step.id === 'push')
        return {
          kind: 'external',
          prepare: async () => context,
          execute: async ({ context: prepared }) => {
            if (!prepared.signedPsbt)
              throw new OneKeyLocalError('Babylon signature missing');
            await push();
            return { type: 'completed', context: {} };
          },
        };
      throw new OneKeyLocalError('Unexpected protocol step');
    }) satisfies IFragment['getAdapter'],
  };
  const initialContext: IContext = {};
  const task = createEarnWithdrawApprovalTask<
    string,
    string,
    IContext,
    IFacts,
    IFact
  >({
    taskId: 'one-withdraw-task',
    identity,
    protocolSteps,
    initialContext,
    approval,
    allowanceCheck: async () => true,
    prepareBusiness: async (
      handoff: IEarnWithdrawWorkflowHandoff<string, IContext, IFact>,
    ) => {
      await handoff.register(fragment);
    },
    isCurrent: () => current,
    isCurrentAfterHandoff: () => current,
    signal: signal.signal,
    onAsyncError,
    retained: {
      facts: {
        initial: { build: 'pending' } satisfies IFacts,
        reduce: (_facts: IFacts, fact: IFact): IFacts => ({
          build: fact.broadcast ? 'broadcast' : 'prepared',
        }),
      },
    },
  });
  const submitSignature = async ({
    accountId = identity.accountId,
    networkId = identity.networkId,
    requestId = 'request-1',
    psbt = 'synthetic-psbt',
  }: {
    accountId?: string;
    networkId?: string;
    requestId?: string;
    psbt?: string;
  } = {}) => {
    if (!continuation) throw new OneKeyLocalError('Continuation unavailable');
    const accepted = continuation.claim({
      context: { signedPsbt: psbt },
      hasPayload: Boolean(psbt),
      eligible:
        accountId === identity.accountId &&
        networkId === identity.networkId &&
        requestId === 'request-1',
    });
    if (!accepted) {
      signed.resolve({ type: 'cancelled' });
      return false;
    }
    signed.resolve({ type: 'continued' });
    await continuation.completion;
    if (!viewDetached) publicCallbacks();
    return true;
  };
  return {
    task,
    signal,
    result,
    ready,
    buildStarted,
    buildResult,
    detached,
    push,
    publicCallbacks,
    submitSignature,
    onAsyncError,
    setCurrent: (value: boolean) => {
      current = value;
    },
    record: (params: IFactParams) => recordFact?.(params) ?? false,
  };
}

it('keeps the ordinary non-retained approval flow unchanged', async () => {
  const steps: readonly IEarnWorkflowStepPlan[] = [
    { id: 'withdraw', kind: 'protocol', lateSubmitted: 'confirming' },
  ];
  const result = deferred<boolean>();
  const navigate = jest.fn();
  const fragment: IEarnWithdrawProtocolFragment<string, IContext> = {
    identity,
    steps,
    result: result.promise,
    getAdapter: () => ({
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'withdraw' }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          navigate();
          onBeforeSend();
          onSubmitted('withdraw-tx');
          result.resolve(true);
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    }),
  };
  const initialContext: IContext = {};
  const task = createEarnWithdrawApprovalTask<string, string, IContext>({
    taskId: 'ordinary',
    identity,
    protocolSteps: steps,
    initialContext,
    approval,
    allowanceCheck: async () => true,
    prepareBusiness: async (handoff) => {
      await handoff.register(fragment);
    },
    isCurrent: () => true,
    onAsyncError: jest.fn(),
  });
  await expect(task.run()).resolves.toBe(true);
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(task.getTask().taskId).toBe('ordinary');
});

it('keeps approval, Babylon build, sign and push in one retained task', async () => {
  const h = retainedFixture({ requireFacts: true });
  const result = h.task.run();
  await waitForProgress(h.ready.promise, result);
  await expect(result).resolves.toBe(true);
  await expect(h.submitSignature()).resolves.toBe(true);
  expect(h.push).toHaveBeenCalledTimes(1);
  expect(h.publicCallbacks).toHaveBeenCalledTimes(1);
  expect(h.task.getTask().taskId).toBe('one-withdraw-task');
  expect(h.task.getTask().steps.map(({ id }) => id)).toEqual([
    'approve',
    'allowance',
    'prepareBusiness',
    'build',
    'sign',
    'push',
  ]);
  expect(h.task.getTask().facts).toEqual({ build: 'prepared' });
  expect(JSON.stringify(h.task.getTask())).not.toContain('synthetic-psbt');
});

it('detaches after sign handoff and pushes a late signature only once', async () => {
  const h = retainedFixture();
  const result = h.task.run();
  await waitForProgress(h.ready.promise, result);
  await expect(result).resolves.toBe(true);
  h.setCurrent(false);
  h.signal.abort();
  expect(h.detached).toHaveBeenCalledTimes(1);
  const attempts = await Promise.all([
    h.submitSignature(),
    h.submitSignature(),
  ]);
  expect(attempts.filter(Boolean)).toHaveLength(1);
  expect(h.push).toHaveBeenCalledTimes(1);
  expect(h.publicCallbacks).not.toHaveBeenCalled();
});

it('preserves a late build broadcast fact after owner abort without opening sign', async () => {
  const h = retainedFixture({ pendingBuild: true, requireFacts: true });
  const result = h.task.run();
  const build = await waitForProgress(h.buildStarted.promise, result);
  h.setCurrent(false);
  h.signal.abort();
  await expect(result).resolves.toBe(false);
  h.buildResult.resolve({ broadcast: true });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.detached).toHaveBeenCalledTimes(1);
  expect(h.task.getTask().facts).toEqual({ build: 'broadcast' });
  expect(
    h.task.getTask().steps.find(({ id }) => id === 'build')?.status.type,
  ).toBe('completed');
  expect(
    h.task.getTask().steps.find(({ id }) => id === 'sign')?.status.type,
  ).toBe('waiting');
  expect(h.push).not.toHaveBeenCalled();
  expect(
    h.record({
      stepId: build.stepId,
      attemptId: 'wrong-attempt',
      fact: { type: 'buildAccepted', broadcast: false },
    }),
  ).toBe(false);
  expect(h.task.getTask().facts).toEqual({ build: 'broadcast' });
  const approvalAttempt = h.task
    .getTask()
    .steps.find(({ id }) => id === 'approve')?.attemptId;
  if (!approvalAttempt) throw new OneKeyLocalError('Approval attempt missing');
  expect(
    h.record({
      stepId: 'approve',
      attemptId: approvalAttempt,
      fact: { type: 'buildAccepted', broadcast: false },
    }),
  ).toBe(false);
  expect(h.task.getTask().facts).toEqual({ build: 'broadcast' });
});

it.each([
  { accountId: 'other-account' },
  { networkId: 'other-network' },
  { requestId: 'other-request' },
  { psbt: '' },
])(
  'does not push a signed result with a mismatched binding: %p',
  async (invalid) => {
    const h = retainedFixture();
    const result = h.task.run();
    await waitForProgress(h.ready.promise, result);
    await expect(result).resolves.toBe(true);
    await expect(h.submitSignature(invalid)).resolves.toBe(false);
    expect(h.push).not.toHaveBeenCalled();
    expect(h.publicCallbacks).not.toHaveBeenCalled();
  },
);

it('keeps the dispatched continuation after a false navigation result', async () => {
  const h = retainedFixture({ handedOff: false });
  const result = h.task.run();
  await waitForProgress(h.ready.promise, result);
  await expect(result).resolves.toBe(false);
  expect(h.detached).toHaveBeenCalledTimes(1);
  await expect(h.submitSignature()).resolves.toBe(true);
  expect(h.push).toHaveBeenCalledTimes(1);
  expect(h.publicCallbacks).not.toHaveBeenCalled();
});

it('removes the owner abort listener after the retained protocol finishes', async () => {
  const h = retainedFixture();
  const removeListener = jest.spyOn(h.signal.signal, 'removeEventListener');
  const result = h.task.run();
  await waitForProgress(h.ready.promise, result);
  await expect(result).resolves.toBe(true);
  await expect(h.submitSignature()).resolves.toBe(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
});
