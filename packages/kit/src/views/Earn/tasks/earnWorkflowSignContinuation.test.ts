import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnWorkflowTaskController } from './earnWorkflowTaskController';
import { createEarnWorkflowTask } from './earnWorkflowTaskState';

type IContext = { psbt?: string };
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function harness() {
  const ready = deferred<void>();
  const signed = deferred<{ type: 'continued' } | { type: 'cancelled' }>();
  const push = jest.fn<Promise<void>, [string]>(async () => undefined);
  const onSuccess = jest.fn();
  let receive: ((psbt: string) => Promise<void>) | undefined;
  let close: (() => void) | undefined;
  let current = true;
  const task = createEarnWorkflowTask({
    taskId: 'task',
    identity: {
      accountId: 'account',
      networkId: 'btc--0',
      provider: 'babylon',
    },
    steps: [
      { id: 'sign', kind: 'sign' },
      { id: 'push', kind: 'external' },
    ],
  });
  const controller = createEarnWorkflowTaskController({
    task,
    initialContext: {} as IContext,
    retained: true,
    isCurrent: () => current,
    expiredMessage: 'expired',
    onAsyncError: jest.fn(),
    getAdapter: (step, context) =>
      step.kind === 'sign'
        ? {
            kind: 'sign',
            run: async ({ createContinuation }) => {
              const capability = createContinuation({
                externalStepId: 'push',
                requestId: 'request',
              });
              close = () => {
                capability.close();
                signed.resolve({ type: 'cancelled' });
              };
              receive = async (psbt) => {
                if (
                  !capability.claim({
                    context: { psbt },
                    hasPayload: Boolean(psbt),
                    eligible: true,
                  })
                ) {
                  signed.resolve({ type: 'cancelled' });
                  return;
                }
                signed.resolve({ type: 'continued' });
                await capability.completion;
                if (current) onSuccess();
              };
              ready.resolve();
              return signed.promise;
            },
          }
        : {
            kind: 'external',
            prepare: async () => context,
            execute: async () => {
              await push(context.psbt ?? '');
              return { type: 'completed', context: {} };
            },
          },
  });
  const owner = controller.attachOwner(() => current);
  const running = controller.run(owner);
  return {
    controller,
    owner,
    running,
    ready: ready.promise,
    push,
    onSuccess,
    receive: (psbt: string) => receive?.(psbt),
    close: () => close?.(),
    expire: () => {
      current = false;
    },
  };
}

it('continues a single signed callback after owner detach and does not notify the old page', async () => {
  const h = harness();
  await h.ready;
  h.expire();
  expect(h.controller.detachOwner(h.owner)).toBe(true);
  expect(h.controller.getTask().steps[0].status.type).toBe('running');
  expect(h.controller.getTask().signContinuation?.status).toBe('dispatched');
  const first = h.receive('signed-psbt');
  const duplicate = h.receive('signed-psbt');
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.controller.getTask().signContinuation?.status).toBe('claimed');
  expect(h.controller.getTask().steps.map((step) => step.status.type)).toEqual([
    'completed',
    'completed',
  ]);
  expect(h.push).toHaveBeenCalledTimes(1);
  await Promise.all([first, duplicate]);
  await h.running;
  expect(h.push).toHaveBeenCalledTimes(1);
  expect(h.push).toHaveBeenCalledWith('signed-psbt');
  expect(h.onSuccess).not.toHaveBeenCalled();
  expect(h.controller.getTask().steps[1].status.type).toBe('completed');
  expect(JSON.stringify(h.controller.getTask())).not.toContain('signed-psbt');
});

it('lets a synchronous navigation callback wait for its external result without deadlock', async () => {
  const h = harness();
  await h.ready;
  const navigation = (async () => {
    await h.receive('signed-psbt');
  })();
  await expect(navigation).resolves.toBeUndefined();
  await h.running;
  expect(h.push).toHaveBeenCalledTimes(1);
  expect(h.onSuccess).toHaveBeenCalledTimes(1);
});

it('preserves an uncertain push error and never retries its external step', async () => {
  const h = harness();
  const failure = new OneKeyLocalError('push unavailable');
  h.push.mockRejectedValueOnce(failure);
  await h.ready;
  const callback = h.receive('signed-psbt');
  await expect(callback).rejects.toBe(failure);
  await expect(h.running).rejects.toBe(failure);
  expect(h.controller.getTask().steps[1].status.type).toBe('unknown');
  await h.controller.run(h.owner);
  expect(h.push).toHaveBeenCalledTimes(1);
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it('does not permit a signed callback after the confirmation was closed', async () => {
  const h = harness();
  await h.ready;
  h.close();
  await h.receive('signed-psbt');
  await h.running;
  expect(h.push).not.toHaveBeenCalled();
  expect(h.controller.getTask().steps[0].status.type).toBe('cancelled');
});
