import { createEarnTaskStore } from './createEarnTaskStore';
import {
  createEarnSignContinuation,
  createEarnSignContinuationToken,
  reduceEarnSignContinuation,
} from './earnSignContinuation';
import {
  createEarnWorkflowTask,
  reduceEarnWorkflowTask,
} from './earnWorkflowTaskState';

import type { IEarnSignContinuationEvent } from './earnSignContinuation';
import type { IEarnWorkflowTaskEvent } from './earnWorkflowTaskState';

const binding = {
  taskId: 'task',
  signStepId: 'sign',
  signAttemptId: 'attempt',
  externalStepId: 'push',
  accountId: 'account',
  networkId: 'btc--0',
  provider: 'babylon',
  requestId: 'request',
};
function harness(requestId: string | undefined = binding.requestId) {
  const token = createEarnSignContinuationToken();
  const expectedBinding = { ...binding, requestId };
  let state = createEarnSignContinuation();
  const apply = (event: IEarnSignContinuationEvent) => {
    const previous = state;
    state = reduceEarnSignContinuation(state, event, {
      binding: expectedBinding,
      token,
    });
    return previous !== state;
  };
  const event = (
    payload:
      | { type: 'dispatch' | 'cancel' | 'deny' }
      | { type: 'signed'; hasPayload: boolean; eligible?: boolean },
  ): IEarnSignContinuationEvent => ({
    taskId: binding.taskId,
    signStepId: binding.signStepId,
    signAttemptId: binding.signAttemptId,
    externalStepId: binding.externalStepId,
    accountId: binding.accountId,
    networkId: binding.networkId,
    provider: binding.provider,
    requestId,
    token,
    ...(payload.type === 'signed'
      ? { ...payload, eligible: payload.eligible ?? Boolean(requestId) }
      : payload),
  });
  return { apply, event, getState: () => state, token };
}

it('grants a dispatched confirmation one claim for the bound external step', () => {
  const h = harness();
  const signed = h.event({ type: 'signed', hasPayload: true });
  expect(h.apply(signed)).toBe(false);
  expect(h.apply(h.event({ type: 'dispatch' }))).toBe(true);
  expect(h.apply(signed)).toBe(true);
  expect(h.getState().status).toBe('claimed');
  expect(h.apply(signed)).toBe(false);
  expect(h.apply(h.event({ type: 'cancel' }))).toBe(false);
});

it.each([
  'taskId',
  'signStepId',
  'signAttemptId',
  'externalStepId',
  'accountId',
  'networkId',
  'provider',
  'requestId',
] as const)('rejects a callback bound to another %s', (key) => {
  const h = harness();
  h.apply(h.event({ type: 'dispatch' }));
  const previous = h.getState();
  expect(
    h.apply({
      ...h.event({ type: 'signed', hasPayload: true }),
      [key]: 'other',
    }),
  ).toBe(false);
  expect(h.getState()).toBe(previous);
});

it('rejects a different one-time token', () => {
  const h = harness();
  h.apply(h.event({ type: 'dispatch' }));
  expect(
    h.apply({
      ...h.event({ type: 'signed', hasPayload: true }),
      token: createEarnSignContinuationToken(),
    }),
  ).toBe(false);
  expect(h.getState().status).toBe('dispatched');
});

it.each(['cancel', 'deny'] as const)(
  'closes the capability after %s',
  (type) => {
    const h = harness();
    h.apply(h.event({ type: 'dispatch' }));
    expect(h.apply(h.event({ type }))).toBe(true);
    expect(h.apply(h.event({ type: 'signed', hasPayload: true }))).toBe(false);
    expect(h.getState().status).toBe('closed');
  },
);

it('closes a missing signed payload or request identity without authorizing a later callback', () => {
  const missingPayload = harness();
  missingPayload.apply(missingPayload.event({ type: 'dispatch' }));
  missingPayload.apply(
    missingPayload.event({ type: 'signed', hasPayload: false }),
  );
  expect(missingPayload.getState().status).toBe('closed');
  expect(
    missingPayload.apply(
      missingPayload.event({ type: 'signed', hasPayload: true }),
    ),
  ).toBe(false);
  const missingRequest = harness('');
  missingRequest.apply(missingRequest.event({ type: 'dispatch' }));
  missingRequest.apply(
    missingRequest.event({ type: 'signed', hasPayload: true }),
  );
  expect(missingRequest.getState().status).toBe('closed');
});

it('allows a provider to authorize a continuation without a request id', () => {
  const h = harness('');
  h.apply(h.event({ type: 'dispatch' }));
  h.apply(h.event({ type: 'signed', hasPayload: true, eligible: true }));
  expect(h.getState().status).toBe('claimed');
});

it('stores no duplicate task identity in capability state', () => {
  expect(createEarnSignContinuation()).toEqual({ status: 'created' });
});

it('contains no signed payload or private token in the observable state', () => {
  const h = harness();
  h.apply(h.event({ type: 'dispatch' }));
  const supplied = Object.assign(
    h.event({ type: 'signed', hasPayload: true }),
    { psbt: 'secret-psbt' },
  );
  h.apply(supplied);
  expect(JSON.stringify(h.getState())).not.toContain('secret-psbt');
  expect(Object.values(h.getState())).not.toContain(h.token);
});

it('can claim synchronously inside navigation without requiring navigation to finish', async () => {
  const h = harness();
  let completePush: (() => void) | undefined;
  const pushFinished = new Promise<void>((resolve) => {
    completePush = resolve;
  });
  h.apply(h.event({ type: 'dispatch' }));
  const navigate = async () => {
    expect(h.apply(h.event({ type: 'signed', hasPayload: true }))).toBe(true);
    await pushFinished;
  };
  const navigation = navigate();
  expect(h.getState().status).toBe('claimed');
  completePush?.();
  await expect(navigation).resolves.toBeUndefined();
});

it('can atomically claim and start one external step in a single leased store', async () => {
  const token = createEarnSignContinuationToken();
  const task = createEarnWorkflowTask({
    taskId: binding.taskId,
    identity: {
      accountId: binding.accountId,
      networkId: binding.networkId,
      provider: binding.provider,
    },
    steps: [
      { id: binding.signStepId, kind: 'sign' },
      { id: binding.externalStepId, kind: 'external' },
    ],
  });
  type IEvent =
    | { kind: 'capability'; event: IEarnSignContinuationEvent }
    | { kind: 'workflow'; event: IEarnWorkflowTaskEvent };
  const store = createEarnTaskStore<
    {
      task: typeof task;
      capability: ReturnType<typeof createEarnSignContinuation>;
    },
    IEvent
  >({
    initialState: { task, capability: createEarnSignContinuation() },
    reduce: (state, entry) => {
      if (entry.kind === 'capability') {
        const capability = reduceEarnSignContinuation(
          state.capability,
          entry.event,
          { binding, token },
        );
        return capability === state.capability
          ? state
          : { ...state, capability };
      }
      const nextTask = reduceEarnWorkflowTask(state.task, entry.event);
      return nextTask === state.task ? state : { ...state, task: nextTask };
    },
  });
  const capability = (event: IEarnSignContinuationEvent): IEvent => ({
    kind: 'capability',
    event,
  });
  const workflow = (
    stepId: string,
    attemptId: string,
    payload: IEarnWorkflowTaskEvent['payload'],
  ): IEvent => ({
    kind: 'workflow',
    event: { taskId: binding.taskId, stepId, attemptId, payload },
  });
  const event = (type: 'dispatch' | 'signed'): IEarnSignContinuationEvent => ({
    ...binding,
    token,
    ...(type === 'dispatch'
      ? { type }
      : { type, hasPayload: true, eligible: true }),
  });
  const owner = Symbol('workflow-owner');
  expect(store.acquire(owner)).toBe(true);
  expect(
    store.dispatchBatch([
      workflow(binding.signStepId, binding.signAttemptId, {
        kind: 'sign',
        action: 'start',
      }),
      capability(event('dispatch')),
    ]),
  ).toBe(true);
  let finishPush: (() => void) | undefined;
  const pushFinished = new Promise<void>((resolve) => {
    finishPush = resolve;
  });
  const push = jest.fn(async (psbt: string) => {
    expect(psbt).toBe('secret-psbt');
    await pushFinished;
  });
  const onSuccess = jest.fn();
  let resultCurrent = true;
  const signed = async (psbt: string) => {
    const accepted = store.dispatchBatch([
      capability(event('signed')),
      workflow(binding.signStepId, binding.signAttemptId, {
        kind: 'sign',
        action: 'complete',
      }),
      workflow(binding.externalStepId, 'push-attempt', {
        kind: 'external',
        action: 'start',
      }),
      workflow(binding.externalStepId, 'push-attempt', {
        kind: 'external',
        action: 'invoke',
      }),
    ]);
    if (!accepted) return;
    await push(psbt);
    store.dispatch(
      workflow(binding.externalStepId, 'push-attempt', {
        kind: 'external',
        action: 'accepted',
      }),
    );
    if (resultCurrent) onSuccess();
  };
  const navigation = (async () => {
    await signed('secret-psbt');
  })();
  await signed('duplicate-psbt');
  expect(push).toHaveBeenCalledTimes(1);
  expect(store.owns(owner)).toBe(true);
  expect(JSON.stringify(store.getState())).not.toContain('secret-psbt');
  resultCurrent = false;
  finishPush?.();
  await navigation;
  expect(store.getState().task.steps[1].status.type).toBe('completed');
  expect(onSuccess).not.toHaveBeenCalled();
  store.release(owner);
});

it('does not reauthorize after the existing external reducer marks a push unknown', () => {
  const h = harness();
  h.apply(h.event({ type: 'dispatch' }));
  expect(h.apply(h.event({ type: 'signed', hasPayload: true }))).toBe(true);
  let task = createEarnWorkflowTask({
    taskId: binding.taskId,
    identity: {
      accountId: binding.accountId,
      networkId: binding.networkId,
      provider: binding.provider,
    },
    steps: [{ id: binding.externalStepId, kind: 'external' }],
  });
  const external = (
    attemptId: string,
    action: 'start' | 'invoke' | 'fail' | 'retry',
  ) => {
    task = reduceEarnWorkflowTask(task, {
      taskId: binding.taskId,
      stepId: binding.externalStepId,
      attemptId,
      payload: { kind: 'external', action },
    });
  };
  external('push-attempt', 'start');
  external('push-attempt', 'invoke');
  external('push-attempt', 'fail');
  expect(task.steps[0].status.type).toBe('unknown');
  const beforeRetry = task;
  external('new-attempt', 'retry');
  expect(task).toBe(beforeRetry);
  expect(h.apply(h.event({ type: 'signed', hasPayload: true }))).toBe(false);
});
